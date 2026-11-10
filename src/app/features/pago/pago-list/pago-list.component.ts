import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { imprimirRecibo as imprimirReciboComun, usuarioEmisor } from '../../../shared/documento/recibo.util';

import { MovementsService } from '../../stock/services/movements.service';
import { Pago, PagoService } from '../service/pago.service';

/** Una línea de la compra: el producto que se compró al proveedor. */
interface ProductoCompra {
  articulo: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

/** Una compra (movimientos de ENTRADA con el mismo código) y su estado de pago. */
interface Compra {
  codigoCompra: string;
  proveedorNombre: string;
  fecha?: string;
  productos: ProductoCompra[];
  totalCompra: number;
  totalPagado: number;
  saldoPendiente: number;
  estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  formaPago: string;
}

/**
 * PENDIENTES = compras con saldo por pagar.
 * GESTION    = compras pagadas por completo (historial, recibo y anular).
 */
type Vista = 'PENDIENTES' | 'GESTION';

@Component({
  selector: 'app-pago-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pago-list.component.html',
  styleUrls: ['../../../shared/onu-pantalla.css', './pago-list.component.css']
})
export class PagoListComponent implements OnInit {
  /** Formas de pago disponibles en la ventana «Registrar pago». */
  readonly formasPago = [
    { valor: 'EFECTIVO', texto: 'Efectivo', icono: 'fa-money-bill-wave' },
    { valor: 'TRANSFERENCIA', texto: 'Transferencia', icono: 'fa-building-columns' },
    { valor: 'QR', texto: 'QR', icono: 'fa-qrcode' },
    { valor: 'TARJETA', texto: 'Tarjeta', icono: 'fa-credit-card' },
    { valor: 'DEPOSITO', texto: 'Depósito', icono: 'fa-piggy-bank' },
    { valor: 'OTRO', texto: 'Otro', icono: 'fa-ellipsis' }
  ];

  private route = inject(ActivatedRoute);
  private movementsService = inject(MovementsService);
  private pagoService = inject(PagoService);

  /** La ruta decide qué módulo es: data: { vista: 'PENDIENTES' | 'GESTION' } */
  readonly vista: Vista = this.route.snapshot.data['vista'] ?? 'PENDIENTES';

  compras: Compra[] = [];
  comprasFiltradas: Compra[] = [];
  pagos: Pago[] = [];

  busqueda = '';
  filtroEstado = 'TODOS';
  cargando = false;
  errorCarga = false;

  mostrarFormulario = false;
  mostrandoHistorial = false;
  compraSeleccionada: Compra | null = null;

  historial: Pago[] = [];
  cargandoHistorial = false;

  monto = 0;
  formaPago = 'EFECTIVO';
  observaciones = '';
  guardando = false;

  ngOnInit(): void {
    this.cargarDatos();
  }

  get titulo(): string {
    return this.vista === 'PENDIENTES' ? 'Pagos pendientes' : 'Gestionar pagos';
  }

  get subtitulo(): string {
    return this.vista === 'PENDIENTES'
      ? 'Compras con saldo por pagar, con los productos de cada una.'
      : 'Compras pagadas por completo: consulta el historial, imprime el recibo o anula un pago.';
  }

  // ── Carga de datos ──────────────────────────────────────────────

  cargarDatos(): void {
    this.cargando = true;
    this.errorCarga = false;

    forkJoin({
      movimientos: this.movementsService.getAll('', ''),
      pagos: this.pagoService.getAll()
    }).subscribe({
      next: ({ movimientos, pagos }) => {
        this.pagos = pagos ?? [];
        this.construirCompras(movimientos ?? []);
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.errorCarga = true;

        Swal.fire({
          icon: 'error',
          title: 'No se pudieron cargar los datos',
          text: 'Verifica que el backend esté funcionando e inténtalo de nuevo.',
          confirmButtonColor: '#1b6f6f'
        });
      }
    });
  }

  /** Los pagos anulados no cuentan; los antiguos sin estado se consideran activos. */
  esActivo(pago: Pago): boolean {
    return !pago.estado || pago.estado === 'ACTIVO';
  }

  private montoDe(m: any): number {
    const guardado = Number(m.total ?? m.subtotal ?? m.liquido ?? 0);
    if (guardado > 0) return guardado;

    const precio = Number(m.product?.precio ?? m.producto?.precio ?? 0);
    return Number(m.cantidad ?? 0) * precio;
  }

  private construirCompras(movimientos: any[]): void {
    const grupos = new Map<string, any[]>();

    movimientos
      .filter(m => String(m.tipo ?? m.tipoMovimiento ?? '').toUpperCase() === 'ENTRADA')
      .filter(m =>
        !m.estadoMovimiento ||
        String(m.estadoMovimiento).toUpperCase() === 'ACTIVO'
      )
      .filter(m => !!m.codigo)
      .forEach(m => {
        const codigo = String(m.codigo).trim();
        const grupo = grupos.get(codigo) ?? [];
        grupo.push(m);
        grupos.set(codigo, grupo);
      });

    this.compras = Array.from(grupos.entries()).map(([codigo, items]) => {
      const productos: ProductoCompra[] = items.map(item => {
        const cantidad = Number(item.cantidad ?? 0);
        const subtotal = this.montoDe(item);

        return {
          articulo:
            item.product?.articulo ??
            item.producto?.articulo ??
            item.articulo ??
            'Producto sin nombre',
          cantidad,
          precioUnitario: cantidad > 0 ? subtotal / cantidad : subtotal,
          subtotal
        };
      });

      const totalCompra = productos.reduce((suma, p) => suma + p.subtotal, 0);

      const totalRegistrado = this.pagos
        .filter(p => this.esActivo(p) && String(p.codigoCompra).trim() === codigo)
        .reduce((suma, p) => suma + Number(p.monto ?? 0), 0);

      const estadoOriginal = String(items[0].estadoPago ?? 'PENDIENTE')
        .trim()
        .toUpperCase();

      // Una compra marcada como pagada al contado no tiene registros de pago.
      const totalPagado =
        estadoOriginal === 'PAGADO' && totalRegistrado === 0
          ? totalCompra
          : totalRegistrado;

      const saldoPendiente = Math.max(0, totalCompra - totalPagado);

      let estadoPago: Compra['estadoPago'];
      if (saldoPendiente <= 0.01) estadoPago = 'PAGADO';
      else if (totalPagado > 0) estadoPago = 'PARCIAL';
      else estadoPago = 'PENDIENTE';

      return {
        codigoCompra: codigo,
        proveedorNombre:
          items[0].responsable ??
          items[0].proveedorNombre ??
          'Sin registrar',
        fecha: items[0].fecha,
        productos,
        totalCompra,
        totalPagado,
        saldoPendiente,
        estadoPago,
        formaPago: items[0].formaPago ?? 'No especificada'
      };
    });

    this.compras.sort((a, b) =>
      String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''))
    );

    this.aplicarFiltros();
  }

  tieneSaldo(compra: Compra): boolean {
    return compra.saldoPendiente > 0.01;
  }

  /** Compra saldada sin registros de pago: se pagó al contado al comprarla. */
  esContado(compra: Compra): boolean {
    return !this.pagos.some(
      p => this.esActivo(p) && String(p.codigoCompra).trim() === compra.codigoCompra
    );
  }

  aplicarFiltros(): void {
    const texto = this.busqueda.trim().toLowerCase();

    this.comprasFiltradas = this.compras.filter(compra => {
      // Pendientes: solo con saldo. Gestión: solo pagadas por completo.
      const coincideVista =
        this.vista === 'PENDIENTES' ? this.tieneSaldo(compra) : !this.tieneSaldo(compra);

      const coincideTexto =
        compra.codigoCompra.toLowerCase().includes(texto) ||
        compra.proveedorNombre.toLowerCase().includes(texto) ||
        compra.productos.some(p => p.articulo.toLowerCase().includes(texto));

      const coincideEstado =
        this.vista === 'GESTION' ||
        this.filtroEstado === 'TODOS' ||
        compra.estadoPago === this.filtroEstado;

      return coincideVista && coincideTexto && coincideEstado;
    });
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroEstado = 'TODOS';
    this.aplicarFiltros();
  }

  // ── Registrar un pago ───────────────────────────────────────────

  abrirPago(compra: Compra): void {
    if (!this.tieneSaldo(compra)) {
      Swal.fire({
        icon: 'info',
        title: 'Compra pagada',
        text: 'Esta compra no tiene saldo pendiente.',
        confirmButtonColor: '#1b6f6f'
      });
      return;
    }

    this.compraSeleccionada = compra;
    this.monto = Number(compra.saldoPendiente.toFixed(2));
    this.formaPago = 'EFECTIVO';
    this.observaciones = '';
    this.mostrarFormulario = true;
    this.mostrandoHistorial = false;
  }

  cerrarFormulario(): void {
    if (this.guardando) return;

    this.mostrarFormulario = false;
    this.compraSeleccionada = null;
  }

  registrarPago(): void {
    const compra = this.compraSeleccionada;
    const monto = Number(this.monto);

    if (!compra || !Number.isFinite(monto) || monto <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Monto inválido',
        text: 'Ingresa un monto mayor que cero.',
        confirmButtonColor: '#1b6f6f'
      });
      return;
    }

    if (monto > compra.saldoPendiente + 0.01) {
      Swal.fire({
        icon: 'warning',
        title: 'Monto excedido',
        text: `El saldo pendiente es ${this.moneda(compra.saldoPendiente)}.`,
        confirmButtonColor: '#1b6f6f'
      });
      return;
    }

    this.guardando = true;

    this.pagoService.create({
      codigoCompra: compra.codigoCompra,
      monto,
      formaPago: this.formaPago,
      observaciones: this.observaciones.trim()
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarFormulario = false;
        this.compraSeleccionada = null;

        Swal.fire({
          icon: 'success',
          title: '¡Pago registrado!',
          text: 'El pago se guardó correctamente.',
          timer: 1800,
          showConfirmButton: false
        });

        this.cargarDatos();
      },
      error: (err: any) => {
        this.guardando = false;
        this.mostrarError(err, 'No se pudo registrar el pago.');
      }
    });
  }

  // ── Historial ───────────────────────────────────────────────────

  verHistorial(compra: Compra): void {
    this.compraSeleccionada = compra;
    this.mostrandoHistorial = true;
    this.mostrarFormulario = false;
    this.historial = [];
    this.cargandoHistorial = true;

    this.pagoService.getByCodigoCompra(compra.codigoCompra).subscribe({
      next: (datos: Pago[]) => {
        this.historial = datos ?? [];
        this.cargandoHistorial = false;
      },
      error: () => {
        this.historial = [];
        this.cargandoHistorial = false;

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo consultar el historial.',
          confirmButtonColor: '#1b6f6f'
        });
      }
    });
  }

  cerrarHistorial(): void {
    this.mostrandoHistorial = false;
    this.compraSeleccionada = null;
    this.historial = [];
  }

  // ── Imprimir recibo ─────────────────────────────────────────────

  /** Recibo de toda la compra, con todos sus pagos activos. */
  imprimirCompra(compra: Compra): void {
    this.pagoService.getByCodigoCompra(compra.codigoCompra).subscribe({
      next: (lista: Pago[]) => {
        const activos = (lista ?? []).filter(p => this.esActivo(p));
        this.imprimirRecibo(compra, activos, compra.codigoCompra);
      },
      error: () => this.mostrarError(null, 'No se pudo preparar el recibo.')
    });
  }

  /** Recibo de un solo pago, desde el historial. */
  imprimirPago(pago: Pago): void {
    if (!this.compraSeleccionada) return;

    this.imprimirRecibo(this.compraSeleccionada, [pago], `CP-${pago.idPago}`);
  }

  private imprimirRecibo(compra: Compra, pagos: Pago[], numero: string): void {
    const lineasPago = pagos.length
      ? pagos.map(p => [this.fechaFormato(p.fecha), p.formaPago, p.observaciones ?? '', this.moneda(Number(p.monto ?? 0))])
      : compra.totalPagado > 0
        ? [[this.fechaFormato(compra.fecha), compra.formaPago, 'Pago al contado', this.moneda(compra.totalPagado)]]
        : [];
    const pagadoAhora = pagos.length
      ? pagos.reduce((t, p) => t + Number(p.monto ?? 0), 0)
      : compra.totalPagado;

    imprimirReciboComun({
      titulo: 'Comprobante de pago',
      numero,
      fecha: this.fechaFormato(new Date().toISOString()),
      emitidoPor: usuarioEmisor(),
      datos: [
        { etiqueta: 'Proveedor', valor: compra.proveedorNombre },
        { etiqueta: 'Compra', valor: compra.codigoCompra },
        { etiqueta: 'Fecha de la compra', valor: this.fechaFormato(compra.fecha) }
      ],
      tablas: [
        {
          titulo: 'Productos',
          columnas: [{ texto: 'Producto' }, { texto: 'Cant.', num: true }, { texto: 'P. unitario', num: true }, { texto: 'Subtotal', num: true }],
          filas: compra.productos.map(p => [p.articulo, p.cantidad, this.moneda(p.precioUnitario), this.moneda(p.subtotal)]),
          vacio: 'Sin productos registrados'
        },
        {
          titulo: 'Detalle de pagos',
          columnas: [{ texto: 'Fecha' }, { texto: 'Forma de pago' }, { texto: 'Observaciones' }, { texto: 'Monto', num: true }],
          filas: lineasPago,
          vacio: 'Sin pagos registrados'
        }
      ],
      totales: [
        { etiqueta: 'Total de la compra', valor: this.moneda(compra.totalCompra) },
        { etiqueta: 'Total pagado', valor: this.moneda(compra.totalPagado) },
        { etiqueta: 'Saldo', valor: this.moneda(compra.saldoPendiente), destacado: true }
      ],
      montoLetras: pagadoAhora,
      sello: compra.saldoPendiente <= 0 ? { texto: 'PAGADO', tipo: 'ok' } : { texto: 'PENDIENTE', tipo: 'warn' },
      firmas: ['Entregué conforme (pagador)', 'Recibí conforme (proveedor)']
    });
  }

  // ── Anular ──────────────────────────────────────────────────────

  /** Botón "Anular" de la fila: si hay varios pagos, deja elegir en el historial. */
  anularCompra(compra: Compra): void {
    this.pagoService.getByCodigoCompra(compra.codigoCompra).subscribe({
      next: (lista: Pago[]) => {
        const activos = (lista ?? []).filter(p => this.esActivo(p));

        if (activos.length === 0) {
          Swal.fire({
            icon: 'info',
            title: 'Nada que anular',
            text: 'Esta compra se pagó al contado y no tiene pagos registrados.',
            confirmButtonColor: '#1b6f6f'
          });
          return;
        }

        if (activos.length === 1) {
          this.compraSeleccionada = compra;
          this.anularPago(activos[0]);
          return;
        }

        this.compraSeleccionada = compra;
        this.historial = lista;
        this.cargandoHistorial = false;
        this.mostrandoHistorial = true;

        Swal.fire({
          icon: 'info',
          title: 'Elige el pago a anular',
          text: 'Esta compra tiene varios pagos. Usa el botón "Anular" del que corresponda.',
          confirmButtonColor: '#1b6f6f'
        });
      },
      error: () => this.mostrarError(null, 'No se pudo consultar los pagos.')
    });
  }

  async anularPago(pago: Pago): Promise<void> {
    if (pago.idPago == null) return;

    const resultado = await Swal.fire({
      icon: 'warning',
      title: '¿Anular este pago?',
      text: `Se anulará ${this.moneda(pago.monto)}. La compra volverá a pagos pendientes.`,
      input: 'textarea',
      inputLabel: 'Motivo (opcional)',
      inputAttributes: { maxlength: '300' },
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d64545'
    });

    if (!resultado.isConfirmed) return;

    this.pagoService.anular(pago.idPago, String(resultado.value ?? '').trim()).subscribe({
      next: () => {
        this.cerrarHistorial();

        Swal.fire({
          icon: 'success',
          title: 'Pago anulado',
          text: 'La compra volvió a pagos pendientes.',
          timer: 2200,
          showConfirmButton: false
        });

        this.cargarDatos();
      },
      error: (err: any) => this.mostrarError(err, 'No se pudo anular el pago.')
    });
  }

  // ── Resumen y formato ───────────────────────────────────────────

  /** Texto del tooltip con todos los productos de la compra. */
  detalleProductos(compra: Compra): string {
    return compra.productos.map(p => `${p.cantidad} × ${p.articulo} (${this.moneda(p.subtotal)})`).join('\n');
  }

  get tarjetas(): { icono: string; etiqueta: string; valor: string; detalle: string; clase: string }[] {
    const pendientes = this.compras.filter(c => this.tieneSaldo(c));
    const saldadas = this.compras.filter(c => !this.tieneSaldo(c));

    if (this.vista === 'PENDIENTES') {
      return [
        {
          icono: 'fa-hourglass-half',
          etiqueta: 'Saldo por pagar',
          valor: this.moneda(pendientes.reduce((s, c) => s + c.saldoPendiente, 0)),
          detalle: `${pendientes.length} compras con saldo`,
          clase: 'stat-warn'
        },
        {
          icono: 'fa-circle-exclamation',
          etiqueta: 'Sin ningún abono',
          valor: String(pendientes.filter(c => c.estadoPago === 'PENDIENTE').length),
          detalle: 'compras pendientes',
          clase: 'stat-bad'
        },
        {
          icono: 'fa-adjust',
          etiqueta: 'Con abonos parciales',
          valor: String(pendientes.filter(c => c.estadoPago === 'PARCIAL').length),
          detalle: 'compras parciales',
          clase: 'stat-warn'
        }
      ];
    }

    return [
      {
        icono: 'fa-circle-check',
        etiqueta: 'Total pagado',
        valor: this.moneda(saldadas.reduce((s, c) => s + c.totalPagado, 0)),
        detalle: `${saldadas.length} compras pagadas`,
        clase: 'stat-ok'
      },
      {
        icono: 'fa-receipt',
        etiqueta: 'Pagos registrados',
        valor: String(this.pagos.filter(p => this.esActivo(p)).length),
        detalle: 'activos en el sistema',
        clase: 'stat-base'
      },
      {
        icono: 'fa-ban',
        etiqueta: 'Pagos anulados',
        valor: String(this.pagos.filter(p => !this.esActivo(p)).length),
        detalle: 'no cuentan en los saldos',
        clase: 'stat-bad'
      }
    ];
  }

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(Number(valor) || 0);
  }

  fechaFormato(fecha?: string): string {
    if (!fecha) return 'Sin fecha';

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) return fecha;

    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  }

  private mostrarError(err: any, porDefecto: string): void {
    const mensaje =
      typeof err?.error === 'string'
        ? err.error
        : err?.error?.message ?? porDefecto;

    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: mensaje,
      confirmButtonColor: '#1b6f6f'
    });
  }
}
