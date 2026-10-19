
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, filter } from 'rxjs';
import Swal from 'sweetalert2';

import { MovementsService } from '../../stock/services/movements.service';
import { Cobro, CobroService } from '../service/cobro.service';
import { ProductService } from '../../products/services/product.service';
import { Product } from '../../../models/product.model';

interface ProductoVenta {
  nombre: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

interface VentaCobro {
  codigoVenta: string;
  clienteNombre: string;
  fecha?: string;
  productos: ProductoVenta[];
  totalVenta: number;
  totalCobrado: number;
  saldoPendiente: number;
  estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  formaPago: string;
}

type VistaCobros = 'REGISTRO' | 'PENDIENTES' | 'GESTION';

@Component({
  selector: 'app-cobros-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobros-list.component.html',
  styleUrls: ['./cobros-list.component.css']
})
export class CobrosListComponent implements OnInit {
  private movementsService = inject(MovementsService);
  private cobroService = inject(CobroService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);

  productosCatalogo: Product[] = [];

  vista: VistaCobros = 'REGISTRO';
  ventas: VentaCobro[] = [];
  ventasFiltradas: VentaCobro[] = [];
  cobros: Cobro[] = [];

  busqueda = '';
  cargando = false;
  errorCarga = false;

  mostrarFormulario = false;
  mostrandoHistorial = false;
  ventaSeleccionada: VentaCobro | null = null;

  historial: Cobro[] = [];
  cargandoHistorial = false;

  monto = 0;
  formaPago = 'EFECTIVO';
  observaciones = '';
  guardando = false;

  get titulo(): string {
    if (this.vista === 'GESTION') return 'Gestión de cobros';
    if (this.vista === 'PENDIENTES') return 'Cobros pendientes';
    return 'Cobros';
  }

  get descripcion(): string {
    if (this.vista === 'GESTION') {
      return 'Consulta los cobros completados, revisa el historial e imprime recibos.';
    }

    if (this.vista === 'PENDIENTES') {
      return 'Ventas con saldo pendiente o pagos parciales.';
    }

    return 'Consulta las ventas y registra pagos de los clientes.';
  }

  ngOnInit(): void {
    this.actualizarVista();

    this.route.data.subscribe(() => {
      this.actualizarVista();
      this.aplicarFiltros();
    });

    this.router.events
      .pipe(filter(evento => evento instanceof NavigationEnd))
      .subscribe(() => {
        this.actualizarVista();
        this.aplicarFiltros();
      });

    this.cargarDatos();
  }

  private actualizarVista(): void {
    const data = this.route.snapshot.data['vistaCobros'] as
      VistaCobros | undefined;

    const url = this.router.url.toLowerCase();

    this.vista = data ?? (
      url.includes('/cobros/gestion')
        ? 'GESTION'
        : url.includes('/cobros/pendientes')
          ? 'PENDIENTES'
          : 'REGISTRO'
    );
  }

  estaAnulado(cobro: Cobro): boolean {
    return String(cobro.estado ?? 'ACTIVO').toUpperCase() === 'ANULADO';
  }

  cargarDatos(): void {
    this.cargando = true;
    this.errorCarga = false;

    forkJoin({
      movimientos: this.movementsService.getAll('', ''),
      cobros: this.cobroService.getAll(),
      productos: this.productService.getAll()
    }).subscribe({
      next: ({ movimientos, cobros, productos }) => {
        this.productosCatalogo = productos ?? [];
        this.cobros = (cobros ?? []).filter(
          cobro => !this.estaAnulado(cobro)
        );

        this.construirVentas(movimientos ?? []);
        this.cargando = false;
      },
      error: error => {
        console.error('Error cargando datos de cobros:', error);
        this.cargando = false;
        this.errorCarga = true;

        Swal.fire(
          'Error',
          'No se pudieron cargar las ventas, productos o cobros. Revisa la consola y el backend.',
          'error'
        );
      }
    });
  }

  private buscarNombreProducto(movimiento: any): string {
    const productoDirecto =
      movimiento.producto ??
      movimiento.productoDTO ??
      movimiento.product;

    const nombreDirecto =
      movimiento.articulo ??
      movimiento.nombreProducto ??
      movimiento.productoNombre ??
      productoDirecto?.articulo ??
      productoDirecto?.nombreProducto ??
      productoDirecto?.nombre ??
      productoDirecto?.name;

    if (nombreDirecto && String(nombreDirecto).trim()) {
      return String(nombreDirecto).trim();
    }

    const idProducto = Number(
      movimiento.idProducto ??
      movimiento.productoId ??
      movimiento.productId ??
      movimiento.product_id ??
      productoDirecto?.idProducto ??
      productoDirecto?.id ??
      productoDirecto?.productId
    );

    const producto = this.productosCatalogo.find((p: any) => {
      const idCatalogo =
        p.idProducto ??
        p.productoId ??
        p.productId ??
        p.product_id ??
        p.id;

      return idProducto > 0 && Number(idCatalogo) === idProducto;
    }) as any;

    const nombreCatalogo =
      producto?.articulo ??
      producto?.nombreProducto ??
      producto?.productoNombre ??
      producto?.nombre ??
      producto?.name ??
      producto?.descripcion;

    if (nombreCatalogo && String(nombreCatalogo).trim()) {
      return String(nombreCatalogo).trim();
    }

    return String(movimiento.descripcion ?? 'Producto sin nombre');
  }

  private construirVentas(movimientos: any[]): void {
    const grupos = new Map<string, any[]>();

    movimientos
      .filter(movimiento =>
        String(
          movimiento.tipo ??
          movimiento.tipoMovimiento ??
          ''
        ).toUpperCase() === 'SALIDA'
      )
      .filter(movimiento =>
        !movimiento.estadoMovimiento ||
        String(movimiento.estadoMovimiento).toUpperCase() === 'ACTIVO'
      )
      .filter(movimiento => !!movimiento.codigo)
      .forEach(movimiento => {
        const codigo = String(movimiento.codigo).trim();
        const grupo = grupos.get(codigo) ?? [];

        grupo.push(movimiento);
        grupos.set(codigo, grupo);
      });

    this.ventas = Array.from(grupos.entries()).map(([codigo, items]) => {
      const productos: ProductoVenta[] = items.map(item => {
        const cantidad = Number(item.cantidad ?? 0);
        const precio = Number(item.precio ?? item.precioUnitario ?? 0);

        const subtotal = Number(
          item.total ??
          item.subtotal ??
          item.liquido ??
          cantidad * precio
        );

        return {
          nombre: this.buscarNombreProducto(item),
          descripcion: String(item.descripcion ?? ''),
          cantidad,
          precio,
          subtotal
        };
      });

      const totalVenta = productos.reduce(
        (suma, producto) => suma + producto.subtotal,
        0
      );

      const cobrosVenta = this.cobros.filter(
        cobro => String(cobro.codigoVenta).trim() === codigo
      );

      const totalCobradoRegistrado = cobrosVenta.reduce(
        (suma, cobro) => suma + Number(cobro.monto ?? 0),
        0
      );

      const estadoOriginal = String(
        items[0].estadoPago ?? 'PENDIENTE'
      ).toUpperCase();

      const totalCobrado =
        estadoOriginal === 'PAGADO' && totalCobradoRegistrado === 0
          ? totalVenta
          : totalCobradoRegistrado;

      const saldoPendiente = Math.max(0, totalVenta - totalCobrado);

      const estadoPago: VentaCobro['estadoPago'] =
        saldoPendiente <= 0.01
          ? 'PAGADO'
          : totalCobrado > 0
            ? 'PARCIAL'
            : 'PENDIENTE';

      return {
        codigoVenta: codigo,
        clienteNombre: String(
          items[0].responsable ??
          items[0].clienteNombre ??
          items[0].cliente?.nombre ??
          'Sin registrar'
        ),
        fecha: items[0].fecha,
        productos,
        totalVenta,
        totalCobrado,
        saldoPendiente,
        estadoPago,
        formaPago: String(items[0].formaPago ?? 'No especificada')
      };
    });

    this.ventas.sort((a, b) =>
      String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''))
    );

    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    const texto = this.busqueda.trim().toLowerCase();

    this.ventasFiltradas = this.ventas.filter(venta => {
      const textoMatch =
        !texto ||
        venta.codigoVenta.toLowerCase().includes(texto) ||
        venta.clienteNombre.toLowerCase().includes(texto) ||
        venta.productos.some(producto =>
          producto.nombre.toLowerCase().includes(texto)
        );

      if (!textoMatch) return false;

      if (this.vista === 'GESTION') {
        return venta.saldoPendiente <= 0.01;
      }

      if (this.vista === 'PENDIENTES') {
        return venta.saldoPendiente > 0.01;
      }

      return true;
    });
  }

  abrirCobro(venta: VentaCobro): void {
    if (venta.saldoPendiente <= 0.01) {
      Swal.fire('Venta pagada', 'Esta venta no tiene saldo pendiente.', 'info');
      return;
    }

    this.ventaSeleccionada = venta;
    this.monto = Number(venta.saldoPendiente.toFixed(2));
    this.formaPago = 'EFECTIVO';
    this.observaciones = '';
    this.mostrarFormulario = true;
    this.mostrandoHistorial = false;
  }

  cerrarFormulario(): void {
    if (!this.guardando) {
      this.mostrarFormulario = false;
      this.ventaSeleccionada = null;
    }
  }

  registrarCobro(): void {
    const venta = this.ventaSeleccionada;
    const monto = Number(this.monto);

    if (!venta || !Number.isFinite(monto) || monto <= 0) {
      Swal.fire('Monto inválido', 'Ingresa un monto mayor que cero.', 'warning');
      return;
    }

    if (monto > venta.saldoPendiente + 0.001) {
      Swal.fire(
        'Monto excedido',
        `El saldo pendiente es ${this.moneda(venta.saldoPendiente)}.`,
        'warning'
      );
      return;
    }

    this.guardando = true;

    this.cobroService.create({
      codigoVenta: venta.codigoVenta,
      monto,
      formaPago: this.formaPago,
      observaciones: this.observaciones.trim()
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarFormulario = false;
        this.ventaSeleccionada = null;

        Swal.fire({
          icon: 'success',
          title: 'Cobro registrado',
          text: 'Se registró el cobro correctamente.',
          timer: 1600,
          showConfirmButton: false
        });

        this.cargarDatos();
      },
      error: err => {
        this.guardando = false;

        Swal.fire(
          'No se pudo registrar',
          typeof err?.error === 'string'
            ? err.error
            : err?.error?.message ?? 'Verifica el backend.',
          'error'
        );
      }
    });
  }

  verHistorial(venta: VentaCobro): void {
    this.ventaSeleccionada = venta;
    this.mostrandoHistorial = true;
    this.mostrarFormulario = false;
    this.historial = [];
    this.cargandoHistorial = true;

    this.cobroService.getByCodigoVenta(venta.codigoVenta).subscribe({
      next: datos => {
        this.historial = datos ?? [];
        this.cargandoHistorial = false;
      },
      error: error => {
        console.error('Error consultando historial:', error);
        this.cargandoHistorial = false;

        Swal.fire(
          'Error',
          'No se pudo consultar el historial. Revisa la ruta del backend y la consola.',
          'error'
        );
      }
    });
  }

  cerrarHistorial(): void {
    this.mostrandoHistorial = false;
    this.ventaSeleccionada = null;
    this.historial = [];
  }

  imprimirRecibo(cobro: Cobro): void {
    const venta = this.ventaSeleccionada;
    if (!venta) return;

    const productos = venta.productos.map(producto =>
      `<tr>
        <td>${this.escapar(producto.nombre)}</td>
        <td>${producto.cantidad}</td>
        <td>${this.moneda(producto.precio)}</td>
        <td>${this.moneda(producto.subtotal)}</td>
      </tr>`
    ).join('');

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Recibo ${cobro.idCobro ?? ''}</title>
<style>
body{font-family:Arial,sans-serif;padding:28px;color:#222}
h1{font-size:22px}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}
.total{font-size:18px;font-weight:bold;margin-top:20px}
</style>
</head>
<body>
<h1>RECIBO DE COBRO</h1>
<p><b>N.º de recibo:</b> ${cobro.idCobro ?? '—'}</p>
<p><b>Venta:</b> ${this.escapar(venta.codigoVenta)}</p>
<p><b>Cliente:</b> ${this.escapar(venta.clienteNombre)}</p>
<p><b>Fecha:</b> ${this.escapar(this.fechaFormato(cobro.fecha))}</p>
<p><b>Forma de pago:</b> ${this.escapar(cobro.formaPago)}</p>
<table>
<thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
<tbody>${productos}</tbody>
</table>
<p class="total">Monto de este cobro: ${this.moneda(cobro.monto)}</p>
<p>Total de venta: ${this.moneda(venta.totalVenta)}</p>
<p>Saldo pendiente: ${this.moneda(venta.saldoPendiente)}</p>
<p>Observaciones: ${this.escapar(cobro.observaciones ?? '—')}</p>
<script>window.onload=()=>window.print()<\/script>
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=850,height=700');

    if (!ventana) {
      Swal.fire(
        'Ventana bloqueada',
        'Permite ventanas emergentes para imprimir el recibo.',
        'warning'
      );
      return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  anularCobro(cobro: Cobro): void {
    if (!cobro.idCobro) {
      Swal.fire(
        'No se puede anular',
        'Este cobro no tiene identificador.',
        'error'
      );
      return;
    }

    if (this.estaAnulado(cobro)) {
      Swal.fire('Cobro anulado', 'Este cobro ya está anulado.', 'info');
      return;
    }

    Swal.fire({
      title: '¿Anular este cobro?',
      text: `Se anulará el cobro de ${this.moneda(cobro.monto)}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#c62828'
    }).then(resultado => {
      if (!resultado.isConfirmed) return;

      this.cobroService.anular(cobro.idCobro!).subscribe({
        next: () => {
          Swal.fire('Cobro anulado', 'El cobro fue anulado.', 'success');

          const venta = this.ventaSeleccionada;

          this.cargarDatos();

          if (venta) {
            this.verHistorial(venta);
          }
        },
        error: err => {
          console.error('Error al anular cobro:', err);

          Swal.fire(
            'No se pudo anular',
            typeof err?.error === 'string'
              ? err.error
              : err?.error?.message ??
              `HTTP ${err.status ?? 'desconocido'}. Comprueba el backend inventory1.`,
            'error'
          );
        }
      });
    });
  }

  private escapar(value: string): string {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return value.replace(/[&<>"']/g, caracter => entidades[caracter] ?? caracter);
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

    const fechaDate = new Date(fecha);

    return Number.isNaN(fechaDate.getTime())
      ? fecha
      : new Intl.DateTimeFormat('es-BO', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(fechaDate);
  }

  get totalVentas(): number {
    return this.ventasFiltradas.reduce(
      (suma, venta) => suma + venta.totalVenta,
      0
    );
  }

  get totalCobrado(): number {
    return this.ventasFiltradas.reduce(
      (suma, venta) => suma + venta.totalCobrado,
      0
    );
  }

  get totalPendiente(): number {
    return this.ventasFiltradas.reduce(
      (suma, venta) => suma + venta.saldoPendiente,
      0
    );
  }
}
