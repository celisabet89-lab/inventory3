import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MovementsService } from '../services/movements.service';
import { ProductService } from '../../products/services/product.service';
import { ClientService } from '../../clients/services/client.service';
import { ProveedorService } from '../../proveedor/service/proveedor.service';
import { UserService } from '../../users/services/user.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-movements-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './movements-manager.component.html',
  styleUrls: ['./movements-manager.component.css']
})
export class MovementsManagerComponent implements OnInit {
  private movSvc = inject(MovementsService);
  private productSvc = inject(ProductService);
  private clientSvc = inject(ClientService);
  private providerSvc = inject(ProveedorService);
  private userSvc = inject(UserService);
  private router = inject(Router);

  // Estados
  activeTab = signal<'COMPRA' | 'VENTA'>('COMPRA');
  movimientos = signal<any[]>([]);
  filteredMovimientos = signal<any[]>([]);
  loading = signal(false);
  showForm = signal(false);
  selectedMovement: any = null;
  isEditMode = false;
  searchTerm = '';

  // Catálogos
  products = signal<any[]>([]);
  clients = signal<any[]>([]);
  providers = signal<any[]>([]);
  users = signal<any[]>([]);
  loadingProducts = signal(false);
  loadingClients = signal(false);
  loadingProviders = signal(false);
  loadingUsers = signal(false);

  // Formulario
  formData = {
    responsable: '',
    nitCi: '',
    productId: null as number | null,
    cantidad: 1,
    precio: 0,
    formaPago: 'contado',
    estadoPago: 'pendiente',
    observaciones: '',
    usuario: '',
    nroMovimiento: ''
  };

  // Opciones para selects
  formasPago = ['contado', 'crédito', 'transferencia', 'tarjeta'];
  estadosPago = ['pendiente', 'pagado', 'anulado'];
  tiposCompra = ['Compras Generales', 'Compras Urgentes', 'Compras Programadas'];
  tiposVenta = ['Generales', 'Especiales', 'Mayor', 'Menor'];

  // Paginación
  currentPage = signal(1);
  itemsPerPage = signal(100);
  totalPages = signal(1);
  Math = Math;

  ngOnInit(): void {
    this.loadProducts();
    this.loadClients();
    this.loadProviders();
    this.loadUsers();
    this.loadMovimientos();
  }

  loadProducts(): void {
    this.loadingProducts.set(true);
    this.productSvc.getAll().subscribe({
      next: (data) => {
        this.products.set(data);
        this.loadingProducts.set(false);
      },
      error: () => this.loadingProducts.set(false)
    });
  }

  loadClients(): void {
    this.loadingClients.set(true);
    this.clientSvc.getAll().subscribe({
      next: (data) => {
        this.clients.set(data);
        this.loadingClients.set(false);
      },
      error: () => this.loadingClients.set(false)
    });
  }

  loadProviders(): void {
    this.loadingProviders.set(true);
    this.providerSvc.getAll().subscribe({
      next: (data) => {
        this.providers.set(data);
        this.loadingProviders.set(false);
      },
      error: () => this.loadingProviders.set(false)
    });
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    this.userSvc.getAll().subscribe({
      next: (data) => {
        this.users.set(data);
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false)
    });
  }

  loadMovimientos(): void {
    this.loading.set(true);

    const tipoFiltro = this.activeTab() === 'COMPRA' ? 'ENTRADA' : 'SALIDA';

    this.movSvc.getAll(this.searchTerm, tipoFiltro).subscribe({
      next: (data) => {
        console.log(`Movimientos de ${this.activeTab()}:`, data);
        this.movimientos.set(data);
        this.filteredMovimientos.set(data);
        this.totalPages.set(Math.ceil(data.length / this.itemsPerPage()) || 1);
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error:', error);
        this.loading.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `No se pudieron cargar las ${this.activeTab() === 'COMPRA' ? 'compras' : 'ventas'}`
        });
      }
    });
  }

  onSearchChange(): void {
    this.loadMovimientos();
  }

  cambiarTab(tipo: 'COMPRA' | 'VENTA'): void {
    this.activeTab.set(tipo);
    this.resetForm();
    this.currentPage.set(1);
    this.searchTerm = '';
    this.loadMovimientos();
  }

  resetForm(): void {
    this.formData = {
      responsable: '',
      nitCi: '',
      productId: null,
      cantidad: 1,
      precio: 0,
      formaPago: 'contado',
      estadoPago: 'pendiente',
      observaciones: '',
      usuario: '',
      nroMovimiento: ''
    };
    this.selectedMovement = null;
    this.isEditMode = false;
  }

  openNew(): void {
    this.resetForm();
    // Generar número de movimiento automático
    const fecha = new Date();
    const prefix = this.activeTab() === 'COMPRA' ? 'C' : 'V';
    this.formData.nroMovimiento = `${prefix}${fecha.getFullYear()}${(fecha.getMonth() + 1).toString().padStart(2, '0')}${fecha.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`;
    this.showForm.set(true);
  }

  openEdit(movement: any): void {
    this.isEditMode = true;
    this.selectedMovement = movement;
    this.formData = {
      responsable: movement.responsable,
      nitCi: movement.nitCi || '',
      productId: movement.product?.idProducto || null,
      cantidad: movement.cantidad,
      precio: movement.precio || 0,
      formaPago: movement.formaPago || 'contado',
      estadoPago: movement.estadoPago || 'pendiente',
      observaciones: movement.observaciones || '',
      usuario: movement.usuario || '',
      nroMovimiento: movement.nroMovimiento || ''
    };
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  guardar(): void {
    // Validaciones
    if (!this.formData.nroMovimiento?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Número de movimiento es requerido' });
      return;
    }
    if (!this.formData.responsable?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: `${this.activeTab() === 'COMPRA' ? 'Proveedor' : 'Cliente'} es requerido` });
      return;
    }
    if (!this.formData.productId) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Debe seleccionar un producto' });
      return;
    }
    if (!this.formData.cantidad || this.formData.cantidad <= 0) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Cantidad debe ser mayor a 0' });
      return;
    }
    if (!this.formData.usuario) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Usuario es requerido' });
      return;
    }

    // Verificar stock para ventas
    if (this.activeTab() === 'VENTA') {
      const producto = this.products().find(p => p.idProducto === this.formData.productId);
      if (producto && (producto.unidad || 0) < this.formData.cantidad) {
        Swal.fire({
          icon: 'error',
          title: 'Stock insuficiente',
          text: `Stock disponible: ${producto.unidad || 0}`
        });
        return;
      }
    }

    const total = (this.formData.precio || 0) * this.formData.cantidad;

    const body = {
      tipo: this.activeTab() === 'COMPRA' ? 'ENTRADA' : 'SALIDA',
      nroMovimiento: this.formData.nroMovimiento.trim(),
      responsable: this.formData.responsable.trim(),
      nitCi: this.formData.nitCi?.trim() || null,
      productId: this.formData.productId,
      cantidad: this.formData.cantidad,
      precio: this.formData.precio,
      total: total,
      formaPago: this.formData.formaPago,
      estadoPago: this.formData.estadoPago,
      tipoDetalle: this.activeTab() === 'COMPRA' ? 'Compras Generales' : 'Generales',
      usuario: this.formData.usuario,
      observaciones: this.formData.observaciones?.trim() || null
    };

    this.loading.set(true);

    const operation = this.isEditMode && this.selectedMovement?.idMovimiento
      ? this.movSvc.update(this.selectedMovement.idMovimiento, body)
      : this.movSvc.create(body);

    operation.subscribe({
      next: () => {
        this.loading.set(false);
        this.closeForm();
        this.updateProductStock();
        this.loadMovimientos();

        Swal.fire({
          icon: 'success',
          title: this.isEditMode ? 'Actualizado' : 'Registrado',
          text: `${this.activeTab() === 'COMPRA' ? 'Compra' : 'Venta'} ${this.isEditMode ? 'actualizada' : 'registrada'} correctamente`,
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (error) => {
        this.loading.set(false);
        console.error('Error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error?.message || 'No se pudo guardar el movimiento'
        });
      }
    });
  }

  updateProductStock(): void {
    if (this.formData.productId && this.formData.cantidad) {
      const producto = this.products().find(p => p.idProducto === this.formData.productId);
      if (producto) {
        const nuevoStock = this.activeTab() === 'COMPRA'
          ? (producto.unidad || 0) + this.formData.cantidad
          : (producto.unidad || 0) - this.formData.cantidad;

        this.productSvc.update(producto.idProducto, { ...producto, unidad: Math.max(0, nuevoStock) })
          .subscribe({
            next: () => this.loadProducts(),
            error: (err) => console.error('Error actualizando stock:', err)
          });
      }
    }
  }

  anularMovimiento(movement: any): void {
    const texto = this.activeTab() === 'COMPRA' ? 'compra' : 'venta';

    Swal.fire({
      title: `¿Anular ${texto}?`,
      text: `¿Estás seguro de anular ${texto} #${movement.nroMovimiento}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.loading.set(true);

        // Revertir stock
        const producto = this.products().find(p => p.idProducto === movement.product?.idProducto);
        if (producto) {
          const stockRevertido = this.activeTab() === 'COMPRA'
            ? (producto.unidad || 0) - movement.cantidad
            : (producto.unidad || 0) + movement.cantidad;

          this.productSvc.update(producto.idProducto, { ...producto, unidad: Math.max(0, stockRevertido) })
            .subscribe();
        }

        this.movSvc.delete(movement.idMovimiento).subscribe({
          next: () => {
            this.loadMovimientos();
            this.loading.set(false);
            Swal.fire({
              icon: 'success',
              title: 'Anulada',
              text: `La ${texto} ha sido anulada correctamente`,
              timer: 1500,
              showConfirmButton: false
            });
          },
          error: (error) => {
            this.loading.set(false);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error.error?.message || `No se pudo anular la ${texto}`
            });
          }
        });
      }
    });
  }

  verDetalle(movement: any): void {
    this.router.navigate(['/stock/movements/report', movement.idMovimiento]);
  }

  formatDate(fecha: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(value || 0);
  }

  getUsuarioNombre(username: string): string {
    const user = this.users().find(u => u.username === username || u.nombre === username);
    return user?.nombre || username || '—';
  }

  getEstadoPagoClass(estado: string): string {
    const classes: Record<string, string> = {
      'pendiente': 'badge-warning',
      'pagado': 'badge-success',
      'anulado': 'badge-danger'
    };
    return classes[estado] || 'badge-secondary';
  }

  getFormaPagoClass(forma: string): string {
    const classes: Record<string, string> = {
      'contado': 'badge-success',
      'crédito': 'badge-info',
      'transferencia': 'badge-primary',
      'tarjeta': 'badge-purple'
    };
    return classes[forma] || 'badge-secondary';
  }

  getPaginatedMovements(): any[] {
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    return this.filteredMovimientos().slice(start, start + this.itemsPerPage());
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages();
    const current = this.currentPage();
    const maxVisible = 5;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  onItemsPerPageChange(): void {
    this.currentPage.set(1);
    this.totalPages.set(Math.ceil(this.filteredMovimientos().length / this.itemsPerPage()) || 1);
  }
}
