import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { AuthService } from '../../../core/services/auth.service';
import { ProductService } from '../../products/services/product.service';
import { UserService } from '../../users/services/user.service';
import { MovementsService } from '../services/movements.service';

@Component({
  selector: 'app-movements-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './movements-manager.component.html',
  styleUrls: ['./movements-manager.component.css']
})
export class MovementsManagerComponent implements OnInit {

  private movSvc = inject(MovementsService);
  private userSvc = inject(UserService);
  private productSvc = inject(ProductService);
  private authService = inject(AuthService);

  activeTab = signal<'COMPRA' | 'VENTA'>('COMPRA');

  movimientos = signal<any[]>([]);
  filteredMovimientos = signal<any[]>([]);

  products = signal<any[]>([]);

  loading = signal(false);

  users = signal<any[]>([]);
  usuarioActualNombre = signal('Usuario');

  searchTerm = '';

  currentPage = signal(1);
  itemsPerPage = signal(100);
  totalPages = signal(1);

  Math = Math;

  ngOnInit(): void {
    this.cargarUsuarioActual();
    this.loadUsers();
    this.loadProducts();
    this.loadMovimientos();
  }

  cargarUsuarioActual(): void {
    const usuario = this.authService.getCurrentUser();

    if (!usuario) {
      this.usuarioActualNombre.set('Usuario');
      return;
    }

    const nombre = this.obtenerNombreUsuario(usuario);

    this.usuarioActualNombre.set(
      nombre || usuario.email || 'Usuario'
    );
  }

  obtenerNombreUsuario(usuario: any): string {
    if (!usuario) {
      return '';
    }

    const nombre =
      usuario.name ??
      usuario.nombre ??
      usuario.firstName ??
      usuario.nombres ??
      usuario.profile?.name ??
      usuario.profile?.nombre ??
      '';

    const apellido =
      usuario.lastName ??
      usuario.apellido ??
      usuario.surname ??
      usuario.apellidos ??
      usuario.profile?.lastName ??
      usuario.profile?.apellido ??
      '';

    const nombreCompleto =
      `${nombre} ${apellido}`.trim();

    if (nombreCompleto) {
      return nombreCompleto;
    }

    return (
      usuario.username ??
      usuario.email ??
      ''
    );
  }

  loadUsers(): void {
    this.userSvc.getAll().subscribe({
      next: (data) => {
        this.users.set(
          Array.isArray(data)
            ? data
            : []
        );
      },
      error: (error) => {
        console.error(
          'Error cargando usuarios:',
          error
        );
        this.users.set([]);
      }
    });
  }

  loadProducts(): void {
    this.productSvc.getAll().subscribe({
      next: (data) => {
        this.products.set(
          Array.isArray(data)
            ? data
            : []
        );
      },
      error: (error) => {
        console.error(
          'Error cargando productos:',
          error
        );
        this.products.set([]);
      }
    });
  }

  getProductoNombre(
    movimiento: any
  ): string {
    if (!movimiento) {
      return '—';
    }

    const nombreDirecto =
      movimiento.articulo ||
      movimiento.productoNombre ||
      movimiento.nombreProducto ||
      movimiento.producto?.articulo ||
      movimiento.producto?.nombre ||
      movimiento.product?.articulo ||
      movimiento.product?.nombre;

    if (
      nombreDirecto &&
      String(nombreDirecto).trim()
    ) {
      return String(
        nombreDirecto
      ).trim();
    }

    const idProducto =
      movimiento.idProducto ??
      movimiento.productoId ??
      movimiento.product_id ??
      movimiento.product?.idProducto ??
      movimiento.product?.id ??
      movimiento.producto?.idProducto ??
      movimiento.producto?.id;

    if (
      idProducto === null ||
      idProducto === undefined
    ) {
      return 'Producto no identificado';
    }

    const producto =
      this.products().find(
        (p: any) => {

          const idsProducto = [
            p.idProducto,
            p.id,
            p.productId,
            p.product_id
          ];

          return idsProducto.some(
            id =>
              id !== null &&
              id !== undefined &&
              Number(id) === Number(idProducto)
          );
        }
      );

    if (producto) {
      return (
        producto.articulo ||
        producto.nombre ||
        producto.descripcion ||
        `Producto #${idProducto}`
      );
    }

    return `Producto #${idProducto}`;
  }

  loadMovimientos(): void {
    this.loading.set(true);

    this.movSvc.getAll('', '').subscribe({
      next: (data) => {

        const todos =
          Array.isArray(data)
            ? data
            : [];

        const tipoEsperado =
          this.activeTab() === 'COMPRA'
            ? 'ENTRADA'
            : 'SALIDA';

        let movimientos =
          todos.filter(
            (mov: any) => {

              const tipo =
                String(
                  mov.tipo ||
                  mov.tipoMovimiento ||
                  ''
                )
                  .trim()
                  .toUpperCase();

              return tipo === tipoEsperado;
            }
          );

        const texto =
          this.searchTerm
            .trim()
            .toLowerCase();

        if (texto) {

          movimientos =
            movimientos.filter(
              (mov: any) => {

                const producto =
                  this.getProductoNombre(
                    mov
                  );

                const usuario =
                  this.getUsuarioNombre(
                    mov
                  );

                const contenido = [

                  mov.nroMovimiento,
                  mov.codigo,
                  mov.idMovimiento,
                  mov.idMovements,
                  mov.idProducto,
                  producto,
                  mov.responsable,
                  usuario,
                  mov.formaPago,
                  mov.estadoPago,
                  mov.estadoMovimiento,
                  mov.tipoDetalle,
                  mov.tipo,
                  mov.cantidad,
                  mov.total

                ]
                  .map(
                    (valor: any) => {

                      if (
                        valor &&
                        typeof valor === 'object'
                      ) {

                        return [
                          valor.nombre,
                          valor.name,
                          valor.username,
                          valor.email,
                          valor.articulo,
                          valor.lastName,
                          valor.apellido
                        ]
                          .filter(Boolean)
                          .join(' ');
                      }

                      return valor ?? '';
                    }
                  )
                  .join(' ')
                  .toLowerCase();

                return contenido.includes(
                  texto
                );
              }
            );
        }

        this.movimientos.set(
          movimientos
        );

        this.filteredMovimientos.set(
          movimientos
        );

        this.totalPages.set(
          Math.ceil(
            movimientos.length /
            this.itemsPerPage()
          ) || 1
        );

        this.currentPage.set(1);
        this.loading.set(false);
      },

      error: (error) => {

        console.error(
          'Error cargando movimientos:',
          error
        );

        this.movimientos.set([]);
        this.filteredMovimientos.set([]);
        this.totalPages.set(1);
        this.loading.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text:
            `No se pudieron cargar las ${
              this.activeTab() === 'COMPRA'
                ? 'compras'
                : 'ventas'
            }`
        });
      }
    });
  }

  cambiarTab(
    tipo: 'COMPRA' | 'VENTA'
  ): void {

    this.activeTab.set(tipo);
    this.searchTerm = '';
    this.currentPage.set(1);

    this.loadMovimientos();
  }

  onSearchChange(): void {
    this.currentPage.set(1);
    this.loadMovimientos();
  }

  getUsuarioNombre(
    valor: any
  ): string {

    if (!valor) {
      return 'Sin registrar';
    }

    const pareceUsuarioDirecto =
      typeof valor === 'object' &&
      (
        valor.idUser !== undefined ||
        valor.userId !== undefined ||
        valor.idUsuario !== undefined ||
        valor.profile !== undefined ||
        valor.email !== undefined
      );

    if (pareceUsuarioDirecto) {

      const nombre =
        this.obtenerNombreUsuario(
          valor
        );

      if (nombre) {
        return nombre;
      }
    }

    const movimiento = valor;

    const usuarioDirecto =
      movimiento.user ??
      movimiento.usuarioObj ??
      movimiento.usuarioMovimiento;

    if (
      usuarioDirecto &&
      typeof usuarioDirecto === 'object'
    ) {

      const nombre =
        this.obtenerNombreUsuario(
          usuarioDirecto
        );

      if (nombre) {
        return nombre;
      }
    }

    if (
      movimiento.usuario &&
      typeof movimiento.usuario === 'object'
    ) {

      const nombre =
        this.obtenerNombreUsuario(
          movimiento.usuario
        );

      if (nombre) {
        return nombre;
      }
    }

    const posiblesIds = [

      movimiento.userId,
      movimiento.user_id,
      movimiento.idUser,
      movimiento.idUsuario,
      movimiento.usuarioId,
      movimiento.usuario_id,

      movimiento.user?.idUser,
      movimiento.user?.id,
      movimiento.user?.userId,
      movimiento.user?.idUsuario,

      movimiento.usuario?.idUser,
      movimiento.usuario?.id,
      movimiento.usuario?.userId,
      movimiento.usuario?.idUsuario,

      typeof movimiento.usuario === 'number'
        ? movimiento.usuario
        : null,

      typeof movimiento.usuario === 'string' &&
      /^\d+$/.test(
        movimiento.usuario
      )
        ? movimiento.usuario
        : null
    ];

    const idUsuario =
      posiblesIds.find(
        id =>
          id !== null &&
          id !== undefined &&
          id !== '' &&
          Number.isFinite(
            Number(id)
          )
      );

    if (
      idUsuario !== undefined &&
      idUsuario !== null
    ) {

      const id =
        Number(idUsuario);

      const usuario =
        this.users().find(
          (u: any) => {

            const idsUsuario = [

              u.idUser,
              u.id,
              u.userId,
              u.idUsuario

            ];

            return idsUsuario.some(
              value =>
                value !== null &&
                value !== undefined &&
                Number(value) === id
            );
          }
        );

      if (usuario) {

        const nombre =
          this.obtenerNombreUsuario(
            usuario
          );

        if (nombre) {
          return nombre;
        }
      }
    }

    const nombresDirectos = [

      movimiento.usuarioNombre,
      movimiento.nombreUsuario,
      movimiento.userName,
      movimiento.username,
      movimiento.nombreUsuarioMovimiento

    ];

    const nombreDirecto =
      nombresDirectos.find(
        value =>
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ''
      );

    if (nombreDirecto) {
      return String(
        nombreDirecto
      ).trim();
    }

    if (
      movimiento.user?.email
    ) {
      return String(
        movimiento.user.email
      );
    }

    return 'Sin registrar';
  }

  formatDate(
    fecha: any
  ): string {

    if (!fecha) {
      return '—';
    }

    const valor =
      String(fecha).trim();

    const matchISO =
      valor.match(
        /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
      );

    if (matchISO) {

      return (
        `${matchISO[3]}/` +
        `${matchISO[2]}/` +
        `${matchISO[1]} ` +
        `${matchISO[4]}:` +
        `${matchISO[5]}`
      );
    }

    const matchLatino =
      valor.match(
        /^(\d{2})\/(\d{2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})/
      );

    if (matchLatino) {

      return (
        `${matchLatino[1]}/` +
        `${matchLatino[2]}/` +
        `${matchLatino[3]} ` +
        `${String(
          matchLatino[4]
        ).padStart(2, '0')}:` +
        `${matchLatino[5]}`
      );
    }

    const matchFecha =
      valor.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

    if (matchFecha) {

      return (
        `${matchFecha[3]}/` +
        `${matchFecha[2]}/` +
        `${matchFecha[1]}`
      );
    }

    return '—';
  }

  getMovimientoTotal(
    mov: any
  ): number {

    if (!mov) {
      return 0;
    }

    if (
      mov.total !== null &&
      mov.total !== undefined
    ) {

      const total =
        Number(
          mov.total
        );

      if (
        Number.isFinite(total)
      ) {
        return total;
      }
    }

    const precio =
      Number(
        mov.precio || 0
      );

    const cantidad =
      Number(
        mov.cantidad || 0
      );

    return precio * cantidad;
  }

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
    ).format(
      Number(value) || 0
    );
  }

  getEstadoPagoClass(
    estado: string
  ): string {

    const classes:
      Record<string, string> = {

      pendiente: 'badge-warning',
      pagado: 'badge-success',
      anulado: 'badge-danger',
      cancelado: 'badge-danger'

    };

    return (
      classes[
        String(
          estado || ''
        ).toLowerCase()
        ] ||
      'badge-secondary'
    );
  }

  getFormaPagoClass(
    forma: string
  ): string {

    const classes:
      Record<string, string> = {

      contado: 'badge-success',
      crédito: 'badge-info',
      transferencia: 'badge-primary',
      tarjeta: 'badge-purple'

    };

    return (
      classes[
        String(
          forma || ''
        ).toLowerCase()
        ] ||
      'badge-secondary'
    );
  }

  verDetalles(
    mov: any
  ): void {

    if (!mov) {
      return;
    }

    const tipo =
      String(
        mov.tipo ||
        mov.tipoMovimiento ||
        ''
      )
        .trim()
        .toUpperCase();

    const titulo =
      tipo === 'SALIDA'
        ? 'Detalle de venta'
        : 'Detalle de compra';

    const usuario =
      this.getUsuarioNombre(
        mov
      );

    const producto =
      this.getProductoNombre(
        mov
      );

    const total =
      this.formatCurrency(
        this.getMovimientoTotal(
          mov
        )
      );

    const numero =
      mov.codigo ||
      mov.nroMovimiento ||
      mov.idMovements ||
      mov.idMovimiento ||
      '—';

    Swal.fire({

      icon: 'info',

      title: titulo,

      html: `
        <div style="
          text-align:left;
          line-height:1.9;
        ">

          <div>
            <strong>Número:</strong>
            ${this.escapeHtml(numero)}
          </div>

          <div>
            <strong>Fecha:</strong>
            ${this.escapeHtml(
        this.formatDate(
          mov.fecha
        )
      )}
          </div>

          <div>
            <strong>Producto:</strong>
            ${this.escapeHtml(producto)}
          </div>

          <div>
            <strong>Cantidad:</strong>
            ${this.escapeHtml(
        mov.cantidad ?? '—'
      )}
          </div>

          <div>
            <strong>Usuario:</strong>
            ${this.escapeHtml(usuario)}
          </div>

          <div>
            <strong>
              ${
        tipo === 'SALIDA'
          ? 'Cliente'
          : 'Proveedor'
      }:
            </strong>
            ${this.escapeHtml(
        mov.responsable || '—'
      )}
          </div>

          <div>
            <strong>Total:</strong>
            ${this.escapeHtml(total)}
          </div>

          <div>
            <strong>Forma de pago:</strong>
            ${this.escapeHtml(
        mov.formaPago || '—'
      )}
          </div>

          <div>
            <strong>Estado de pago:</strong>
            ${this.escapeHtml(
        mov.estadoPago || '—'
      )}
          </div>

          <div>
            <strong>Estado:</strong>
            ${this.escapeHtml(
        mov.estadoMovimiento ||
        'ACTIVO'
      )}
          </div>

          <div>
            <strong>Observaciones:</strong>
            ${this.escapeHtml(
        mov.observaciones || '—'
      )}
          </div>

        </div>
      `,

      confirmButtonText: 'Cerrar',

      width: 550
    });
  }

  private escapeHtml(
    value: any
  ): string {

    return String(
      value ?? ''
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

  async anularMovimiento(
    mov: any
  ): Promise<void> {

    if (!mov) {
      return;
    }

    const id =
      mov.idMovements ??
      mov.idMovimiento ??
      mov.id;

    if (
      id === null ||
      id === undefined
    ) {

      await Swal.fire({

        icon: 'error',

        title: 'Error',

        text:
          'No se encontró el ID del movimiento.'
      });

      return;
    }

    const tipo =
      String(
        mov.tipo ||
        mov.tipoMovimiento ||
        ''
      )
        .trim()
        .toUpperCase();

    const descripcion =
      tipo === 'SALIDA'
        ? 'venta'
        : 'compra';

    const estado =
      String(
        mov.estadoMovimiento ||
        ''
      )
        .trim()
        .toUpperCase();

    if (
      estado === 'ANULADO'
    ) {

      await Swal.fire({

        icon: 'info',

        title:
          'Movimiento ya anulado',

        text:
          'Este movimiento ya fue anulado.'
      });

      return;
    }

    const confirmacion =
      await Swal.fire({

        icon: 'warning',

        title:
          `¿Anular esta ${descripcion}?`,

        html: `
          <div style="
            text-align:left;
            line-height:1.8;
          ">

            <div>
              <strong>Número:</strong>
              ${this.escapeHtml(
          mov.codigo ||
          mov.nroMovimiento ||
          id
        )}
            </div>

            <div>
              <strong>Producto:</strong>
              ${this.escapeHtml(
          this.getProductoNombre(mov)
        )}
            </div>

            <div>
              <strong>Cantidad:</strong>
              ${this.escapeHtml(
          mov.cantidad ?? '—'
        )}
            </div>

          </div>
        `,

        showCancelButton: true,

        confirmButtonText:
          'Sí, anular',

        cancelButtonText:
          'Cancelar',

        confirmButtonColor:
          '#dc2626'

      });

    if (
      !confirmacion.isConfirmed
    ) {
      return;
    }

    Swal.fire({

      title: 'Anulando...',

      allowOutsideClick: false,

      allowEscapeKey: false,

      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.movSvc
      .anular(
        Number(id)
      )
      .subscribe({

        next: async () => {

          Swal.close();

          await Swal.fire({

            icon: 'success',

            title:
              'Movimiento anulado',

            text:
              `La ${descripcion} fue anulada correctamente.`,

            confirmButtonText:
              'Aceptar'
          });

          this.loadMovimientos();
        },

        error: async (error) => {

          Swal.close();

          console.error(
            'Error anulando movimiento:',
            error
          );

          const mensaje =
            error?.error?.message ||
            error?.error?.error ||
            error?.message ||
            'No se pudo anular el movimiento.';

          await Swal.fire({

            icon: 'error',

            title:
              'No se pudo anular',

            text:
            mensaje,

            confirmButtonText:
              'Aceptar'
          });
        }
      });
  }

  getPaginatedMovements(): any[] {

    const start =
      (
        this.currentPage() - 1
      ) *
      this.itemsPerPage();

    const end =
      start +
      this.itemsPerPage();

    return this.filteredMovimientos()
      .slice(
        start,
        end
      );
  }

  goToPage(
    page: number
  ): void {

    if (
      page >= 1 &&
      page <= this.totalPages()
    ) {

      this.currentPage.set(
        page
      );
    }
  }

  previousPage(): void {

    if (
      this.currentPage() > 1
    ) {

      this.currentPage.set(
        this.currentPage() - 1
      );
    }
  }

  nextPage(): void {

    if (
      this.currentPage() <
      this.totalPages()
    ) {

      this.currentPage.set(
        this.currentPage() + 1
      );
    }
  }

  getPageNumbers(): number[] {

    const pages: number[] = [];

    const total =
      this.totalPages();

    const current =
      this.currentPage();

    const maxVisible = 5;

    let start =
      Math.max(
        1,
        current -
        Math.floor(
          maxVisible / 2
        )
      );

    const end =
      Math.min(
        total,
        start +
        maxVisible -
        1
      );

    if (
      end - start + 1 <
      maxVisible
    ) {

      start =
        Math.max(
          1,
          end -
          maxVisible +
          1
        );
    }

    for (
      let i = start;
      i <= end;
      i++
    ) {

      pages.push(i);
    }

    return pages;
  }

  onItemsPerPageChange(): void {

    this.currentPage.set(1);

    this.totalPages.set(

      Math.ceil(

        this.filteredMovimientos()
          .length /

        this.itemsPerPage()

      ) || 1
    );
  }
}
