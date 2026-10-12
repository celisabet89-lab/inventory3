import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  ActivatedRoute,
  Router,
  RouterModule
} from '@angular/router';

import {
  FormsModule
} from '@angular/forms';

import Swal from 'sweetalert2';

import {
  MovementsService
} from '../services/movements.service';

@Component({
  selector: 'app-movement-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule
  ],
  templateUrl: './movement-report.component.html',
  styleUrls: ['./movement-report.component.css']
})
export class MovementReportComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private movSvc = inject(MovementsService);

  activeTab = signal<'COMPRA' | 'VENTA'>('COMPRA');

  loading = signal(true);
  error = signal(false);

  movimientos = signal<any[]>([]);
  todosMovimientos = signal<any[]>([]);

  movimiento = signal<any | null>(null);

  mostrarDetalle = signal(false);

  searchTerm = '';
  fechaDesde = '';
  fechaHasta = '';
  estadoPago = 'TODOS';
  estadoMovimiento = 'TODOS';

  totalRegistros = signal(0);
  totalImporte = signal(0);
  totalUnidades = signal(0);
  totalResponsables = signal(0);

  ngOnInit(): void {

    const id =
      this.route.snapshot.paramMap.get('id');

    const ruta =
      this.route.snapshot.url
        .map(segmento => segmento.path)
        .join('/')
        .toLowerCase();

    if (ruta.includes('venta')) {
      this.activeTab.set('VENTA');
    } else {
      this.activeTab.set('COMPRA');
    }

    if (id) {
      this.cargarUno(Number(id));
    } else {
      this.cargarTodos();
    }
  }

  cambiarTab(
    tipo: 'COMPRA' | 'VENTA'
  ): void {

    this.activeTab.set(tipo);

    this.mostrarDetalle.set(false);
    this.movimiento.set(null);

    this.searchTerm = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.estadoPago = 'TODOS';
    this.estadoMovimiento = 'TODOS';

    this.aplicarFiltros();
  }

  cargarUno(id: number): void {

    this.loading.set(true);
    this.error.set(false);

    this.movSvc
      .getById(id)
      .subscribe({

        next: (mov) => {

          if (!mov) {

            this.movimiento.set(null);
            this.error.set(true);

          } else {

            this.movimiento.set(mov);
            this.mostrarDetalle.set(true);

            this.activeTab.set(
              this.esCompra(mov)
                ? 'COMPRA'
                : 'VENTA'
            );
          }

          this.loading.set(false);
        },

        error: (error) => {

          console.error(
            'Error cargando movimiento:',
            error
          );

          this.movimiento.set(null);
          this.error.set(true);
          this.loading.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text:
              'No se pudo cargar el movimiento.'
          });
        }
      });
  }

  cargarTodos(): void {

    this.loading.set(true);
    this.error.set(false);

    this.movSvc
      .getAll()
      .subscribe({

        next: (data) => {

          this.todosMovimientos.set(
            Array.isArray(data)
              ? data
              : []
          );

          this.aplicarFiltros();

          this.loading.set(false);
        },

        error: (error) => {

          console.error(
            'Error cargando reportes:',
            error
          );

          this.todosMovimientos.set([]);
          this.movimientos.set([]);

          this.actualizarResumen([]);

          this.error.set(true);
          this.loading.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text:
              `No se pudo cargar el reporte de ${
                this.activeTab() === 'COMPRA'
                  ? 'compras'
                  : 'ventas'
              }.`
          });
        }
      });
  }

  aplicarFiltros(): void {

    const tipoEsperado =
      this.activeTab() === 'COMPRA'
        ? 'ENTRADA'
        : 'SALIDA';

    let resultado =
      this.todosMovimientos()
        .filter(
          mov =>
            this.obtenerTipo(mov) ===
            tipoEsperado
        );

    const texto =
      this.searchTerm
        .trim()
        .toLowerCase();

    if (texto) {

      resultado =
        resultado.filter(
          mov => {

            const contenido = [

              mov.codigo,
              mov.idMovements,
              mov.idMovimiento,
              mov.responsable,
              mov.formaPago,
              mov.estadoPago,
              mov.estadoMovimiento,
              mov.cantidad,
              mov.total,
              this.getProductoNombre(mov),
              this.getUsuarioNombre(mov)

            ]
              .map(
                valor =>
                  String(valor ?? '')
              )
              .join(' ')
              .toLowerCase();

            return contenido.includes(texto);
          }
        );
    }

    if (
      this.estadoPago !== 'TODOS'
    ) {

      resultado =
        resultado.filter(
          mov =>
            String(
              mov.estadoPago || ''
            )
              .trim()
              .toUpperCase() ===
            this.estadoPago
        );
    }

    if (
      this.estadoMovimiento !==
      'TODOS'
    ) {

      resultado =
        resultado.filter(
          mov =>
            String(
              mov.estadoMovimiento ||
              'ACTIVO'
            )
              .trim()
              .toUpperCase() ===
            this.estadoMovimiento
        );
    }

    if (this.fechaDesde) {

      const desde =
        new Date(
          `${this.fechaDesde}T00:00:00`
        ).getTime();

      resultado =
        resultado.filter(
          mov =>
            this.obtenerFecha(mov) >=
            desde
        );
    }

    if (this.fechaHasta) {

      const hasta =
        new Date(
          `${this.fechaHasta}T23:59:59`
        ).getTime();

      resultado =
        resultado.filter(
          mov =>
            this.obtenerFecha(mov) <=
            hasta
        );
    }

    resultado =
      [...resultado].sort(
        (a, b) =>
          this.obtenerFecha(b) -
          this.obtenerFecha(a)
      );

    this.movimientos.set(resultado);

    this.actualizarResumen(resultado);
  }

  limpiarFiltros(): void {

    this.searchTerm = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.estadoPago = 'TODOS';
    this.estadoMovimiento = 'TODOS';

    this.aplicarFiltros();
  }

  actualizarResumen(
    lista: any[]
  ): void {

    let importe = 0;
    let unidades = 0;

    const responsables =
      new Set<string>();

    lista.forEach(
      mov => {

        importe +=
          this.getTotal(mov);

        unidades +=
          Number(
            mov?.cantidad || 0
          );

        if (mov?.responsable) {

          responsables.add(
            String(
              mov.responsable
            ).trim()
          );
        }
      }
    );

    this.totalRegistros.set(
      lista.length
    );

    this.totalImporte.set(
      importe
    );

    this.totalUnidades.set(
      unidades
    );

    this.totalResponsables.set(
      responsables.size
    );
  }

  esCompra(
    movimiento: any
  ): boolean {

    return (
      this.obtenerTipo(movimiento) ===
      'ENTRADA'
    );
  }

  obtenerTipo(
    movimiento: any
  ): string {

    return String(
      movimiento?.tipo ||
      movimiento?.tipoMovimiento ||
      ''
    )
      .trim()
      .toUpperCase();
  }

  obtenerFecha(
    mov: any
  ): number {

    if (!mov?.fecha) {
      return 0;
    }

    const fecha =
      new Date(mov.fecha);

    const tiempo =
      fecha.getTime();

    return Number.isFinite(tiempo)
      ? tiempo
      : 0;
  }

  getTotal(
    mov: any
  ): number {

    if (
      mov?.total !== null &&
      mov?.total !== undefined
    ) {

      const total =
        Number(mov.total);

      if (
        Number.isFinite(total)
      ) {
        return total;
      }
    }

    const cantidad =
      Number(
        mov?.cantidad || 0
      );

    const precio =
      Number(
        mov?.product?.precio ||
        mov?.precio ||
        0
      );

    return cantidad * precio;
  }

  getProductoNombre(
    mov: any
  ): string {

    return (
      mov?.product?.articulo ||
      mov?.product?.nombre ||
      mov?.articulo ||
      mov?.productoNombre ||
      mov?.nombreProducto ||
      'Producto no identificado'
    );
  }

  getUsuarioNombre(
    mov: any
  ): string {

    const user =
      mov?.user;

    if (user) {

      const nombre =
        user.name ||
        user.nombre ||
        user.firstName ||
        user.nombres ||
        user.profile?.name ||
        '';

      const apellido =
        user.lastName ||
        user.apellido ||
        user.surname ||
        user.apellidos ||
        user.profile?.lastName ||
        '';

      const completo =
        `${nombre} ${apellido}`.trim();

      return (
        completo ||
        user.username ||
        user.email ||
        'Sin registrar'
      );
    }

    return (
      mov?.usuarioNombre ||
      mov?.userName ||
      mov?.username ||
      'Sin registrar'
    );
  }

  getResponsableLabel(): string {

    return this.activeTab() === 'COMPRA'
      ? 'Proveedor'
      : 'Cliente';
  }

  getTipoLabel(): string {

    return this.activeTab() === 'COMPRA'
      ? 'Compra'
      : 'Venta';
  }

  formatFecha(
    fecha: any
  ): string {

    if (!fecha) {
      return '—';
    }

    const valor =
      String(fecha).trim();

    const match =
      valor.match(
        /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/
      );

    if (match) {

      return (
        `${match[3]}/` +
        `${match[2]}/` +
        `${match[1]} ` +
        `${match[4]}:` +
        `${match[5]}`
      );
    }

    const fechaObj =
      new Date(fecha);

    if (
      !Number.isNaN(
        fechaObj.getTime()
      )
    ) {

      return new Intl.DateTimeFormat(
        'es-BO',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }
      ).format(fechaObj);
    }

    return '—';
  }

  formatMoneda(
    valor: number
  ): string {

    return new Intl.NumberFormat(
      'es-BO',
      {
        style: 'currency',
        currency: 'BOB',
        minimumFractionDigits: 2
      }
    ).format(
      Number(valor) || 0
    );
  }

  getEstadoPagoClass(
    estado: string
  ): string {

    const valor =
      String(
        estado || ''
      )
        .trim()
        .toLowerCase();

    const clases:
      Record<string, string> = {

      pagado:
        'estado-pagado',

      pendiente:
        'estado-pendiente',

      anulado:
        'estado-anulado',

      cancelado:
        'estado-anulado'
    };

    return (
      clases[valor] ||
      'estado-sin'
    );
  }

  getEstadoMovimientoClass(
    estado: string
  ): string {

    return (
      String(
        estado || 'ACTIVO'
      )
        .trim()
        .toUpperCase() ===
      'ANULADO'
    )
      ? 'estado-anulado'
      : 'estado-activo';
  }

  verDetalle(
    mov: any
  ): void {

    this.movimiento.set(mov);
    this.mostrarDetalle.set(true);
  }

  cerrarDetalle(): void {

    this.movimiento.set(null);
    this.mostrarDetalle.set(false);
  }

  imprimir(): void {

    const mov =
      this.movimiento();

    if (!mov) {
      return;
    }

    const tipo =
      this.activeTab() === 'COMPRA'
        ? 'RECIBO DE COMPRA'
        : 'RECIBO DE VENTA';

    const responsableLabel =
      this.activeTab() === 'COMPRA'
        ? 'Proveedor'
        : 'Cliente';

    const numero =
      mov.codigo ||
      mov.nroMovimiento ||
      mov.idMovements ||
      '—';

    const producto =
      this.getProductoNombre(mov);

    const descripcion =
      mov.product?.descripcion ||
      'Sin descripción';

    const usuario =
      this.getUsuarioNombre(mov);

    const responsable =
      mov.responsable ||
      '—';

    const fecha =
      this.formatFecha(
        mov.fecha
      );

    const cantidad =
      mov.cantidad ||
      0;

    const precio =
      Number(
        mov.product?.precio ||
        mov.precio ||
        0
      );

    const total =
      this.getTotal(mov);

    const formaPago =
      mov.formaPago ||
      '—';

    const estadoPago =
      mov.estadoPago ||
      '—';

    const estadoMovimiento =
      mov.estadoMovimiento ||
      'ACTIVO';

    const observaciones =
      mov.observaciones ||
      'Sin observaciones';

    const ventana =
      window.open(
        '',
        '_blank',
        'width=420,height=700'
      );

    if (!ventana) {

      Swal.fire({
        icon: 'warning',
        title: 'Ventana bloqueada',
        text:
          'Permite las ventanas emergentes del navegador para imprimir el recibo.'
      });

      return;
    }

    const estadoClass =
      String(
        estadoMovimiento
      )
        .trim()
        .toUpperCase() ===
      'ANULADO'
        ? 'danger'
        : '';

    const html = `
<!DOCTYPE html>
<html lang="es">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    ${this.escapeHtml(tipo)}
  </title>

  <style>

    @page {
      size: 80mm;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html {
      width: 80mm;
      margin: 0;
      padding: 0;
    }

    body {
      width: 80mm;
      margin: 0;
      padding: 0;

      background: #ffffff;

      font-family:
        Arial,
        Helvetica,
        sans-serif;

      color: #111111;

      font-size: 10px;

      line-height: 1.25;

      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .receipt {
      width: 80mm;

      margin: 0;

      padding:
        3mm
        4mm
        4mm;

      background: #ffffff;

      break-inside: avoid;
      page-break-inside: avoid;
    }

    .company {
      text-align: center;

      break-inside: avoid;
      page-break-inside: avoid;
    }

    .company h1 {
      margin: 0;

      font-size: 18px;

      font-weight: 800;

      letter-spacing: 1px;
    }

    .company p {
      margin: 1px 0;

      font-size: 8px;

      color: #374151;
    }

    .title {
      margin: 4px 0;

      text-align: center;

      font-size: 12px;

      font-weight: 800;

      break-inside: avoid;
      page-break-inside: avoid;
    }

    .divider {
      width: 100%;

      margin: 2px 0;

      overflow: hidden;

      white-space: nowrap;

      font-size: 7px;

      color: #111111;
    }

    .line {
      display: flex;

      justify-content:
        space-between;

      align-items:
        flex-start;

      gap: 6px;

      margin: 2px 0;

      break-inside: avoid;

      page-break-inside: avoid;
    }

    .line span {
      flex: 1;

      color: #374151;
    }

    .line strong {
      flex: 1.5;

      text-align: right;

      overflow-wrap: anywhere;
    }

    .product {
      text-align: center;

      padding: 3px 0;

      break-inside: avoid;

      page-break-inside: avoid;
    }

    .product-label {
      font-size: 9px;

      font-weight: 800;
    }

    .product-name {
      margin-top: 3px;

      font-size: 12px;

      font-weight: 700;

      overflow-wrap: anywhere;
    }

    .description {
      margin: 3px 0 5px;

      font-size: 8px;

      color: #4b5563;

      overflow-wrap: anywhere;
    }

    .total {
      display: flex;

      align-items: center;

      justify-content:
        space-between;

      margin: 5px 0;

      font-size: 14px;

      font-weight: 800;

      break-inside: avoid;

      page-break-inside: avoid;
    }

    .total strong {
      font-size: 15px;
    }

    .observation {
      margin-top: 4px;

      font-size: 8px;

      break-inside: avoid;

      page-break-inside: avoid;
    }

    .observation strong {
      display: block;

      margin-bottom: 2px;
    }

    .observation p {
      margin: 0;

      line-height: 1.3;

      overflow-wrap: anywhere;
    }

    .danger {
      color: #dc2626;
    }

    .footer {
      margin-top: 3px;

      text-align: center;

      font-size: 7px;

      color: #4b5563;

      break-inside: avoid;

      page-break-inside: avoid;
    }

    .footer p {
      margin: 1px 0;
    }

  </style>

</head>

<body>

  <div class="receipt">

    <div class="company">

      <h1>
        SIN LIMITE
      </h1>

      <p>
        Sistema de Inventario
      </p>

    </div>

    <div class="divider">
      =================================
    </div>

    <div class="title">
      ${this.escapeHtml(tipo)}
    </div>

    <div class="divider">
      =================================
    </div>

    <div class="line">

      <span>
        Nro:
      </span>

      <strong>
        ${this.escapeHtml(numero)}
      </strong>

    </div>

    <div class="line">

      <span>
        Fecha:
      </span>

      <strong>
        ${this.escapeHtml(fecha)}
      </strong>

    </div>

    <div class="line">

      <span>
        Usuario:
      </span>

      <strong>
        ${this.escapeHtml(usuario)}
      </strong>

    </div>

    <div class="line">

      <span>
        ${this.escapeHtml(responsableLabel)}:
      </span>

      <strong>
        ${this.escapeHtml(responsable)}
      </strong>

    </div>

    <div class="divider">
      ---------------------------------
    </div>

    <div class="product">

      <div class="product-label">
        PRODUCTO
      </div>

      <div class="product-name">
        ${this.escapeHtml(producto)}
      </div>

      <div class="description">
        ${this.escapeHtml(descripcion)}
      </div>

    </div>

    <div class="line">

      <span>
        Cantidad:
      </span>

      <strong>
        ${this.escapeHtml(cantidad)}
      </strong>

    </div>

    <div class="line">

      <span>
        Precio:
      </span>

      <strong>
        ${this.escapeHtml(
      this.formatMoneda(precio)
    )}
      </strong>

    </div>

    <div class="divider">
      ---------------------------------
    </div>

    <div class="total">

      <span>
        TOTAL
      </span>

      <strong>
        ${this.escapeHtml(
      this.formatMoneda(total)
    )}
      </strong>

    </div>

    <div class="divider">
      ---------------------------------
    </div>

    <div class="line">

      <span>
        Forma de pago:
      </span>

      <strong>
        ${this.escapeHtml(formaPago)}
      </strong>

    </div>

    <div class="line">

      <span>
        Estado de pago:
      </span>

      <strong>
        ${this.escapeHtml(estadoPago)}
      </strong>

    </div>

    <div class="line">

      <span>
        Estado:
      </span>

      <strong class="${estadoClass}">
        ${this.escapeHtml(
      estadoMovimiento
    )}
      </strong>

    </div>

    <div class="divider">
      ---------------------------------
    </div>

    <div class="observation">

      <strong>
        Observación
      </strong>

      <p>
        ${this.escapeHtml(observaciones)}
      </p>

    </div>

    <div class="divider">
      =================================
    </div>

    <div class="footer">

      <p>
        Gracias por su preferencia
      </p>

      <p>
        SIN LIMITE
      </p>

    </div>

  </div>

</body>

</html>
    `;

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();

    ventana.onload = () => {

      ventana.focus();

      setTimeout(() => {
        ventana.print();
      }, 300);
    };

    ventana.onafterprint = () => {
      ventana.close();
    };
  }

  escapeHtml(
    valor: any
  ): string {

    return String(
      valor ?? ''
    )
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /'/g,
        '&#039;'
      );
  }

  actualizar(): void {

    this.cargarTodos();
  }

  volver(): void {

    this.router.navigate([
      '/movimientos',
      'gestion-compras'
    ]);
  }
}
