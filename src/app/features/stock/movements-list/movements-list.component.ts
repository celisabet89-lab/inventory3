import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';

import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';

import { firstValueFrom } from 'rxjs';

import Swal from 'sweetalert2';
import { Router } from '@angular/router';

import { MovementsService } from '../services/movements.service';

import {
  ProductService
} from '../../products/services/product.service';

import { Product } from '../../../models/product.model';

import { ClientService } from '../../clients/services/client.service';

import { ProveedorService } from '../../proveedor/service/proveedor.service';

import { Proveedor } from '../../../models/proveedor.model';

import { AuthService } from '../../../core/services/auth.service';


export interface DetalleItem {
  seq: number;

  idProducto: number;

  articulo: string;

  descripcion: string;

  foto: string;

  uMedida: string;

  almacen: string;

  cantidad: number;

  precio: number;

  descuento: number;

  liquido: number;

  subtotal: number;

  _product: Product;
}


@Component({
  selector: 'app-movimientos',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],

  templateUrl: 'movements-list.component.html',

  styleUrls: ['movements-list.component.css']
})


export class MovementsListComponent implements OnInit {

  // ─────────────────────────────────────────────────────────────
  // SERVICIOS
  // ─────────────────────────────────────────────────────────────

  private productService = inject(ProductService);

  private movementsService = inject(MovementsService);

  private clientService = inject(ClientService);

  private proveedorService = inject(ProveedorService);

  private authService = inject(AuthService);

  private fb = inject(FormBuilder);

  private router = inject(Router);


  // ─────────────────────────────────────────────────────────────
  // DATOS
  // ─────────────────────────────────────────────────────────────

  products = signal<Product[]>([]);

  filteredProducts = signal<Product[]>([]);

  clientes = signal<any[]>([]);

  proveedores = signal<Proveedor[]>([]);

  loadingProducts = signal(true);

  loading = signal(false);


  // ─────────────────────────────────────────────────────────────
  // TIPO
  // ─────────────────────────────────────────────────────────────

  tipoMovimiento: 'entrada' | 'salida' = 'entrada';


  // ─────────────────────────────────────────────────────────────
  // PRODUCTOS
  // ─────────────────────────────────────────────────────────────

  productSearch = '';

  detalle: DetalleItem[] = [];

  nextSeq = 1;


  // ─────────────────────────────────────────────────────────────
  // FORMULARIO
  // ─────────────────────────────────────────────────────────────

  movForm!: FormGroup;


  today = new Date()
    .toISOString()
    .split('T')[0];


  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────

  ngOnInit(): void {

    this.initForm();

    this.loadProducts();

    this.loadClientes();

    this.loadProveedores();
  }


  // ─────────────────────────────────────────────────────────────
  // REPORTE
  // ─────────────────────────────────────────────────────────────

  abrirReporteGeneral(): void {

    this.router.navigate([
      '/stock/movements/report'
    ]);
  }


  // ─────────────────────────────────────────────────────────────
  // CLIENTES
  // ─────────────────────────────────────────────────────────────

  loadClientes(): void {

    this.clientService.getAll().subscribe({

      next: (data: any[]) => {

        const clientesActivos =
          (data ?? []).filter(cliente =>

            !cliente.estado ||

            String(cliente.estado)
              .toUpperCase() === 'ACTIVO'

          );

        this.clientes.set(
          clientesActivos
        );
      },

      error: () => {

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los clientes'
        });

      }

    });
  }


  // ─────────────────────────────────────────────────────────────
  // PROVEEDORES
  // ─────────────────────────────────────────────────────────────

  loadProveedores(): void {

    this.proveedorService.getAll().subscribe({

      next: (data: Proveedor[]) => {

        const proveedoresActivos =
          (data ?? []).filter(proveedor =>

            !proveedor.estado ||

            String(proveedor.estado)
              .toUpperCase() === 'ACTIVO'

          );

        this.proveedores.set(
          proveedoresActivos
        );
      },

      error: () => {

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los proveedores'
        });

      }

    });
  }


  // ─────────────────────────────────────────────────────────────
  // NOMBRE CLIENTE
  // ─────────────────────────────────────────────────────────────

  nombreCliente(cliente: any): string {

    if (!cliente) {
      return '';
    }

    const nombre =
      cliente.nombre ??
      cliente.name ??
      cliente.nombres ??
      '';

    const apellido =
      cliente.apellido ??
      cliente.lastName ??
      cliente.apellidos ??
      '';

    const completo =
      `${nombre} ${apellido}`.trim();

    if (completo) {
      return completo;
    }

    return (
      cliente.razonSocial ??
      cliente.empresa ??
      cliente.descripcion ??
      cliente.email ??
      ''
    );
  }


  // ─────────────────────────────────────────────────────────────
  // SELECCIONAR CLIENTE
  // ─────────────────────────────────────────────────────────────

  onClienteSeleccionado(event: Event): void {

    const select =
      event.target as HTMLSelectElement;

    const nombreSeleccionado =
      select.value;

    const cliente =
      this.clientes().find(c =>
        this.nombreCliente(c) === nombreSeleccionado
      );

    this.movForm.patchValue({

      contraparte:
      nombreSeleccionado,

      nitCi:
        cliente?.ci ??
        cliente?.nit ??
        cliente?.nitCi ??
        ''
    });
  }


  // ─────────────────────────────────────────────────────────────
  // NOMBRE PROVEEDOR
  // ─────────────────────────────────────────────────────────────

  nombreProveedor(proveedor: any): string {

    if (!proveedor) {
      return '';
    }

    return (
      proveedor.empresa ??
      proveedor.nombre ??
      proveedor.name ??
      proveedor.razonSocial ??
      ''
    );
  }


  // ─────────────────────────────────────────────────────────────
  // TIPO DE MOVIMIENTO
  // ─────────────────────────────────────────────────────────────

  setTipo(
    tipo: 'entrada' | 'salida'
  ): void {

    if (tipo === this.tipoMovimiento) {
      return;
    }


    if (this.detalle.length > 0) {

      Swal.fire({

        title: '¿Cambiar tipo?',

        text: 'Se limpiará el detalle actual.',

        icon: 'question',

        showCancelButton: true,

        confirmButtonColor:
          tipo === 'entrada'
            ? '#1b6f6f'
            : '#4f46e5',

        confirmButtonText:
          'Sí, cambiar',

        cancelButtonText:
          'No'

      }).then(result => {

        if (result.isConfirmed) {

          this.tipoMovimiento = tipo;

          this.resetForm(false);
        }

      });

    } else {

      this.tipoMovimiento = tipo;

      this.resetForm(false);
    }
  }


  // ─────────────────────────────────────────────────────────────
  // FORMULARIO
  // ─────────────────────────────────────────────────────────────

  initForm(): void {

    this.movForm =
      this.fb.group({

        codigo: [
          {
            value: this.generateCodigo(),
            disabled: true
          }
        ],

        fecha: [
          this.today,
          Validators.required
        ],

        contraparte: [
          '',
          Validators.required
        ],

        fechaLimite: [
          ''
        ],

        nitCi: [
          ''
        ],

        formaPago: [
          'CONTADO',
          Validators.required
        ],

        tipoMoneda: [
          'BOLIVIANOS',
          Validators.required
        ],

        glosa: [
          ''
        ]

      });
  }


  // ─────────────────────────────────────────────────────────────
  // GENERAR CÓDIGO
  // ─────────────────────────────────────────────────────────────

  generateCodigo(): string {

    const prefix =
      this.tipoMovimiento === 'entrada'
        ? 'C'
        : 'V';

    const numero =
      Math.floor(
        10000 +
        Math.random() * 90000
      );

    return prefix + numero;
  }


  // ─────────────────────────────────────────────────────────────
  // PRODUCTOS
  // ─────────────────────────────────────────────────────────────

  loadProducts(): void {

    this.loadingProducts.set(true);

    this.productService.getAll().subscribe({

      next: (data: Product[]) => {

        const productos =
          data ?? [];

        this.products.set(productos);

        this.filteredProducts.set(
          productos
        );

        this.loadingProducts.set(false);
      },

      error: () => {

        this.loadingProducts.set(false);

        Swal.fire({

          icon: 'error',

          title: 'Error',

          text: 'No se pudieron cargar los productos'

        });
      }

    });
  }


  // ─────────────────────────────────────────────────────────────
  // BUSCAR PRODUCTOS
  // ─────────────────────────────────────────────────────────────

  onProductSearch(): void {

    const term =
      this.productSearch
        .toLowerCase()
        .trim();


    if (!term) {

      this.filteredProducts.set(
        this.products()
      );

      return;
    }


    this.filteredProducts.set(

      this.products().filter(p =>

        p.articulo
          ?.toLowerCase()
          .includes(term)

        ||

        p.descripcion
          ?.toLowerCase()
          .includes(term)

        ||

        p.codigoQR
          ?.toLowerCase()
          .includes(term)

        ||

        p.codigoBarras
          ?.toLowerCase()
          .includes(term)

      )
    );
  }


  // ─────────────────────────────────────────────────────────────
  // STOCK
  // ─────────────────────────────────────────────────────────────

  getStockDisponible(
    p: Product
  ): number {

    const enDetalle =
      this.detalle

        .filter(d =>
          d.idProducto ===
          p.idProducto!
        )

        .reduce(
          (acc, d) =>
            acc + d.cantidad,
          0
        );


    return (
      (p.unidad ?? 0) -
      enDetalle
    );
  }


  getStockClass(
    p: Product
  ): string {

    const stock =
      this.getStockDisponible(p);


    if (stock <= 0) {
      return 'stock-zero';
    }


    if (stock <= 5) {
      return 'stock-low';
    }


    return 'stock-ok';
  }


  // ─────────────────────────────────────────────────────────────
  // DETALLE
  // ─────────────────────────────────────────────────────────────

  addProducto(
    p: Product
  ): void {

    if (

      this.tipoMovimiento === 'salida' &&

      this.getStockDisponible(p) <= 0

    ) {

      Swal.fire({

        icon: 'warning',

        title: 'Sin stock',

        text:
          `No hay stock disponible para "${p.articulo}"`,

        timer: 1500,

        showConfirmButton: false

      });

      return;
    }


    const existing =
      this.detalle.find(d =>
        d.idProducto ===
        p.idProducto!
      );


    if (existing) {

      if (

        this.tipoMovimiento === 'salida' &&

        this.getStockDisponible(p) <= 0

      ) {

        return;
      }


      existing.cantidad++;

      this.recalcItem(existing);

      return;
    }


    const precio =
      p.precio ?? 0;


    this.detalle = [

      ...this.detalle,

      {

        seq: this.nextSeq++,

        idProducto:
          p.idProducto!,

        articulo:
          p.articulo ?? '',

        descripcion:
          p.descripcion ??
          p.articulo ??
          '',

        foto:
          p.foto ?? '',

        uMedida:
          'Unidad',

        almacen:
          'Principal',

        cantidad:
          1,

        precio,

        descuento:
          0,

        liquido:
        precio,

        subtotal:
        precio,

        _product:
        p

      }

    ];
  }


  // ─────────────────────────────────────────────────────────────
  // RECALCULAR ITEM
  // ─────────────────────────────────────────────────────────────

  recalcItem(
    item: DetalleItem
  ): void {

    item.cantidad =
      Math.max(
        1,
        Number(item.cantidad) || 1
      );


    item.precio =
      Math.max(
        0,
        Number(item.precio) || 0
      );


    item.descuento =
      Math.min(
        100,
        Math.max(
          0,
          Number(item.descuento) || 0
        )
      );


    item.liquido =

      item.precio *

      (
        1 -
        item.descuento / 100
      );


    item.subtotal =

      item.liquido *

      item.cantidad;


    this.detalle = [
      ...this.detalle
    ];
  }


  // ─────────────────────────────────────────────────────────────
  // ELIMINAR ITEM
  // ─────────────────────────────────────────────────────────────

  removeItem(
    seq: number
  ): void {

    this.detalle =
      this.detalle.filter(
        d => d.seq !== seq
      );
  }


  // ─────────────────────────────────────────────────────────────
  // TOTAL
  // ─────────────────────────────────────────────────────────────

  getTotal(): number {

    return this.detalle.reduce(

      (total, item) =>

        total +
        item.subtotal,

      0
    );
  }


  // ─────────────────────────────────────────────────────────────
  // USUARIO ACTUAL
  // ─────────────────────────────────────────────────────────────

  private getUsuarioActualId(): number | null {

    const usuario =
      this.authService.getCurrentUser();


    if (!usuario) {
      return null;
    }


    const id =
      usuario.id ??
      usuario.userId ??
      usuario.idUser ??
      usuario.idUsuario;


    if (
      id === null ||
      id === undefined
    ) {

      return null;
    }


    const numero =
      Number(id);


    if (
      !Number.isFinite(numero)
    ) {

      return null;
    }


    return numero;
  }


  // ─────────────────────────────────────────────────────────────
  // GUARDAR
  // ─────────────────────────────────────────────────────────────

  guardar(): void {

    if (this.movForm.invalid) {

      Object.keys(
        this.movForm.controls
      ).forEach(key => {

        this.movForm
          .get(key)
          ?.markAsTouched();

      });


      Swal.fire({

        icon: 'warning',

        title:
          'Completa los campos requeridos'

      });

      return;
    }


    if (!this.detalle.length) {

      Swal.fire({

        icon: 'warning',

        title:
          'Sin productos',

        text:
          'Agrega al menos un producto'

      });

      return;
    }


    // ─────────────────────────────────────────────
    // USUARIO HISTÓRICO
    // ─────────────────────────────────────────────

    const userId =
      this.getUsuarioActualId();


    if (userId === null) {

      Swal.fire({

        icon: 'error',

        title:
          'Usuario no identificado',

        text:
          'No se pudo identificar al usuario que está registrando este movimiento. Inicia sesión nuevamente.'

      });

      return;
    }


    // ─────────────────────────────────────────────
    // VALIDAR STOCK
    // ─────────────────────────────────────────────

    if (
      this.tipoMovimiento === 'salida'
    ) {

      const sinStock =
        this.detalle.filter(item =>

          item.cantidad >
          (item._product.unidad ?? 0)

        );


      if (sinStock.length) {

        Swal.fire({

          icon: 'error',

          title:
            'Stock insuficiente',

          html:

            sinStock

              .map(item =>

                `<b>${item.articulo}</b>: ` +

                `pedido <b>${item.cantidad}</b>, ` +

                `disponible <b>${item._product.unidad ?? 0}</b>`

              )

              .join('<br/>')

        });

        return;
      }
    }


    this.loading.set(true);


    const v =
      this.movForm.getRawValue();


    // IMPORTANTE:
    // observaciones contiene SOLO lo escrito
    // por el usuario.
    const observaciones =
      String(
        v.glosa ?? ''
      ).trim();


    const codigo =
      String(
        v.codigo ?? ''
      ).trim();


    const formaPago =
      String(
        v.formaPago ?? ''
      ).trim();


    const estadoPago =
      formaPago === 'CRÉDITO'
        ? 'PENDIENTE'
        : 'PAGADO';


    this.guardarSecuencial(

      v,

      codigo,

      observaciones,

      formaPago,

      estadoPago,

      userId

    );
  }


  // ─────────────────────────────────────────────────────────────
  // GUARDAR PRODUCTOS UNO POR UNO
  // ─────────────────────────────────────────────────────────────

  private async guardarSecuencial(

    v: any,

    codigo: string,

    observaciones: string,

    formaPago: string,

    estadoPago: string,

    userId: number

  ): Promise<void> {

    try {

      for (
        const item of this.detalle
        ) {

        const movimiento = {

          idProducto:
          item.idProducto,

          cantidad:
          item.cantidad,

          tipo:
            this.tipoMovimiento
              .toUpperCase(),

          codigo:
          codigo,

          responsable:
          v.contraparte,

          // SOLO observación real
          observaciones:
            observaciones || null,

          // Usuario que creó
          // este movimiento
          userId:
          userId,

          formaPago:
            formaPago || null,

          estadoPago:
            estadoPago || null,

          total:
            item.subtotal ?? 0

        };


        await firstValueFrom(

          this.movementsService
            .create(movimiento)

        );
      }


      this.loading.set(false);


      Swal.fire({

        icon: 'success',

        title:

          this.tipoMovimiento === 'entrada'

            ? '¡Compra registrada!'

            : '¡Venta registrada!',

        html:

          `<b>${this.detalle.length}</b> ` +

          `producto(s) procesado(s) — ` +

          `Stock actualizado`,

        timer: 2200,

        showConfirmButton: false

      });


      this.resetForm(true);

    }


    catch (err: any) {

      this.loading.set(false);


      const backendMsg =

        err?.error?.message ||

        err?.message ||

        '';


      Swal.fire({

        icon: 'error',

        title:
          'Error al guardar',

        text:

          backendMsg ||

          'No se pudo registrar el movimiento. Verifica el stock disponible.'

      });
    }
  }


  // ─────────────────────────────────────────────────────────────
  // CANCELAR
  // ─────────────────────────────────────────────────────────────

  cancelar(): void {

    if (!this.detalle.length) {

      this.resetForm(true);

      return;
    }


    Swal.fire({

      title:
        '¿Cancelar?',

      text:
        'Se perderán los productos del detalle.',

      icon:
        'question',

      showCancelButton:
        true,

      confirmButtonColor:
        '#ef4444',

      confirmButtonText:
        'Sí, cancelar',

      cancelButtonText:
        'No, volver'

    }).then(result => {

      if (result.isConfirmed) {

        this.resetForm(true);
      }

    });
  }


  // ─────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────

  private resetForm(
    reloadProducts: boolean
  ): void {

    this.detalle = [];

    this.nextSeq = 1;

    this.productSearch = '';


    this.movForm.reset({

      codigo:
        this.generateCodigo(),

      fecha:
      this.today,

      contraparte:
        '',

      fechaLimite:
        '',

      nitCi:
        '',

      formaPago:

        this.tipoMovimiento === 'entrada'

          ? 'CRÉDITO'

          : 'CONTADO',

      tipoMoneda:
        'BOLIVIANOS',

      glosa:
        ''

    });


    if (reloadProducts) {

      this.loadProducts();
    }
  }


  // ─────────────────────────────────────────────────────────────
  // VALIDACIONES
  // ─────────────────────────────────────────────────────────────

  hasError(

    field: string,

    error: string

  ): boolean {

    const control =
      this.movForm.get(field);


    return !!(

      control?.hasError(error) &&

      control.touched

    );
  }


  // ─────────────────────────────────────────────────────────────
  // MONEDA
  // ─────────────────────────────────────────────────────────────

  formatCurrency(
    value: number
  ): string {

    return new Intl.NumberFormat(

      'es-BO',

      {

        style: 'currency',

        currency: 'BOB',

        minimumFractionDigits: 2

      }

    ).format(value);
  }
}
