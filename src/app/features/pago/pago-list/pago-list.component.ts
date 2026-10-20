import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

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
  styleUrls: ['./pago-list.component.css']
})
export class PagoListComponent implements OnInit {
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
      ? pagos.map(p => ({
        fecha: this.fechaFormato(p.fecha),
        monto: Number(p.monto ?? 0),
        formaPago: p.formaPago,
        observaciones: p.observaciones ?? ''
      }))
      : compra.totalPagado > 0
        ? [{
          fecha: this.fechaFormato(compra.fecha),
          monto: compra.totalPagado,
          formaPago: compra.formaPago,
          observaciones: 'Pago al contado'
        }]
        : [];

    const filasProductos = compra.productos
      .map(p => `
        <tr>
          <td>${this.esc(p.articulo)}</td>
          <td class="num">${this.esc(p.cantidad)}</td>
          <td class="num">${this.moneda(p.precioUnitario)}</td>
          <td class="num">${this.moneda(p.subtotal)}</td>
        </tr>`)
      .join('');

    const filasPagos = lineasPago
      .map(p => `
        <tr>
          <td>${this.esc(p.fecha)}</td>
          <td>${this.esc(p.formaPago)}</td>
          <td>${this.esc(p.observaciones)}</td>
          <td class="num">${this.moneda(p.monto)}</td>
        </tr>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Comprobante de pago ${this.esc(numero)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #17212b; margin: 0; padding: 28px; font-size: 13px; }
    .recibo { max-width: 720px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1b6f6f; padding-bottom: 14px; margin-bottom: 18px; }
    header h1 { margin: 0 0 4px; font-size: 20px; color: #155a5a; }
    header p { margin: 0; color: #64748b; font-size: 12px; }
    .numero { text-align: right; font-weight: 700; font-size: 15px; }
    .numero small { display: block; font-weight: 400; font-size: 11px; color: #64748b; }
    .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 18px; }
    .datos span { display: block; color: #64748b; font-size: 11px; }
    h2 { font-size: 13px; margin: 18px 0 6px; color: #155a5a; text-transform: uppercase; letter-spacing: .5px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1b6f6f; color: #fff; text-align: left; padding: 7px 8px; font-size: 11px; }
    td { padding: 7px 8px; border-bottom: 1px solid #d8e0e5; font-size: 12px; }
    .num, th.num { text-align: right; white-space: nowrap; }
    .totales { margin: 18px 0 0 auto; width: 260px; }
    .totales div { display: flex; justify-content: space-between; padding: 5px 0; }
    .totales .saldo { border-top: 2px solid #17212b; margin-top: 4px; padding-top: 8px; font-weight: 700; font-size: 15px; }
    .firmas { display: flex; justify-content: space-around; margin-top: 70px; }
    .firmas div { width: 38%; border-top: 1px solid #17212b; padding-top: 6px; text-align: center; font-size: 11px; color: #64748b; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="recibo">
    <header>
      <div><h1>SÍN LIMITE</h1><p>COMPROBANTE DE PAGO</p></div>
      <div class="numero">N.º ${this.esc(numero)}<small>Emitido: ${this.esc(this.fechaFormato(new Date().toISOString()))}</small></div>
    </header>

    <section class="datos">
      <div><span>Proveedor</span><strong>${this.esc(compra.proveedorNombre)}</strong></div>
      <div><span>Compra</span><strong>${this.esc(compra.codigoCompra)}</strong></div>
    </section>

    <h2>Productos</h2>
    <table>
      <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">P. unitario</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${filasProductos || '<tr><td colspan="4">Sin productos registrados</td></tr>'}</tbody>
    </table>

    <h2>Detalle de pagos</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Forma de pago</th><th>Observaciones</th><th class="num">Monto</th></tr></thead>
      <tbody>${filasPagos || '<tr><td colspan="4">Sin pagos registrados</td></tr>'}</tbody>
    </table>

    <section class="totales">
      <div><span>Total</span><span>${this.moneda(compra.totalCompra)}</span></div>
      <div><span>Total pagado</span><span>${this.moneda(compra.totalPagado)}</span></div>
      <div class="saldo"><span>Saldo</span><span>${this.moneda(compra.saldoPendiente)}</span></div>
    </section>

    <section class="firmas">
      <div>Entregué conforme</div>
      <div>Recibí conforme</div>
    </section>
  </div>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=860,height=900');

    if (!ventana) {
      Swal.fire({
        icon: 'warning',
        title: 'Ventana bloqueada',
        text: 'Permite las ventanas emergentes de este sitio para imprimir el recibo.',
        confirmButtonColor: '#1b6f6f'
      });
      return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  /** Evita que un texto con < o & rompa (o inyecte código en) el recibo. */
  private esc(valor: unknown): string {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  get tarjetas(): { icono: string; etiqueta: string; valor: string; detalle: string; clase: string }[] {
    const pendientes = this.compras.filter(c => this.tieneSaldo(c));
    const saldadas = this.compras.filter(c => !this.tieneSaldo(c));

    if (this.vista === 'PENDIENTES') {
      return [
        {
          icono: '⏰',
          etiqueta: 'Saldo por pagar',
          valor: this.moneda(pendientes.reduce((s, c) => s + c.saldoPendiente, 0)),
          detalle: `${pendientes.length} compras con saldo`,
          clase: 'stat-pending'
        },
        {
          icono: '🔴',
          etiqueta: 'Sin ningún abono',
          valor: String(pendientes.filter(c => c.estadoPago === 'PENDIENTE').length),
          detalle: 'compras pendientes',
          clase: 'stat-sales'
        },
        {
          icono: '🟡',
          etiqueta: 'Con abonos parciales',
          valor: String(pendientes.filter(c => c.estadoPago === 'PARCIAL').length),
          detalle: 'compras parciales',
          clase: 'stat-paid'
        }
      ];
    }

    return [
      {
        icono: '✅',
        etiqueta: 'Total pagado',
        valor: this.moneda(saldadas.reduce((s, c) => s + c.totalPagado, 0)),
        detalle: `${saldadas.length} compras pagadas`,
        clase: 'stat-paid'
      },
      {
        icono: '🧾',
        etiqueta: 'Pagos registrados',
        valor: String(this.pagos.filter(p => this.esActivo(p)).length),
        detalle: 'activos en el sistema',
        clase: 'stat-sales'
      },
      {
        icono: '🚫',
        etiqueta: 'Pagos anulados',
        valor: String(this.pagos.filter(p => !this.esActivo(p)).length),
        detalle: 'no cuentan en los saldos',
        clase: 'stat-pending'
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
