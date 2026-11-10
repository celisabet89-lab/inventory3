import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ProveedorService } from '../service/proveedor.service';
import { ProveedorFormComponent } from '../proveedor-form/proveedor-form.component';

@Component({
  selector: 'app-proveedor-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ProveedorFormComponent],
  templateUrl: './proveedor-list.component.html',
  styleUrls: ['./proveedor-list.component.css']
})
export class ProveedorListComponent implements OnInit {
  private readonly proveedorService = inject(ProveedorService);

  proveedores = signal<any[]>([]);
  filteredProveedores = signal<any[]>([]);
  paisesDisponibles = signal<string[]>([]);
  loading = signal(false);
  showForm = signal(false);
  selectedProveedor: any | null = null;
  isEditMode = false;

  searchTerm = '';
  filtroPais = 'TODOS';
  filtroEstado = 'TODOS';

  stats = signal({ total: 0, activos: 0, inactivos: 0 });
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = signal(1);
  readonly Math = Math;

  ngOnInit(): void {
    this.loadProveedores();
  }

  loadProveedores(): void {
    this.loading.set(true);
    this.proveedorService.getAll().subscribe({
      next: (data: any[]) => {
        const lista = Array.isArray(data) ? data : [];
        this.proveedores.set(lista);
        this.paisesDisponibles.set(
          [...new Set(lista.map(p => String(p?.pais ?? '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'es'))
        );
        this.calcStats(lista);
        this.applyFilters(false);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error al cargar proveedores:', error);
        this.proveedores.set([]);
        this.filteredProveedores.set([]);
        this.paisesDisponibles.set([]);
        this.totalPages.set(1);
        this.loading.set(false);
        Swal.fire({
          icon: 'error',
          title: 'No se pudieron cargar los proveedores',
          text: error?.error?.message || 'Verifica la conexión con el servidor e inténtalo nuevamente.',
          confirmButtonColor: '#1b6f6f'
        });
      }
    });
  }

  calcStats(proveedores: any[]): void {
    this.stats.set({
      total: proveedores.length,
      activos: proveedores.filter(p => String(p?.estado ?? 'ACTIVO').toUpperCase() === 'ACTIVO').length,
      inactivos: proveedores.filter(p => String(p?.estado ?? '').toUpperCase() === 'INACTIVO').length
    });
  }

  applyFilters(resetPage = true): void {
    let result = [...this.proveedores()];
    const term = this.searchTerm.trim().toLocaleLowerCase('es');

    if (term) {
      result = result.filter(p => {
        const values = [
          p?.empresa, p?.contacto, p?.email, p?.ruc, p?.ciNit, p?.nit,
          p?.telefono, p?.celular, p?.pais, p?.direccion, p?.observaciones
        ];
        return values.some(value => String(value ?? '').toLocaleLowerCase('es').includes(term));
      });
    }

    if (this.filtroPais !== 'TODOS') {
      result = result.filter(p => p?.pais === this.filtroPais);
    }

    if (this.filtroEstado !== 'TODOS') {
      result = result.filter(p => String(p?.estado ?? 'ACTIVO').toUpperCase() === this.filtroEstado);
    }

    this.filteredProveedores.set(result);
    this.totalPages.set(Math.max(1, Math.ceil(result.length / this.itemsPerPage)));
    if (resetPage || this.currentPage > this.totalPages()) this.currentPage = 1;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onPaisChange(): void {
    this.applyFilters();
  }

  onEstadoChange(): void {
    this.applyFilters();
  }

  onItemsPerPageChange(): void {
    this.itemsPerPage = Number(this.itemsPerPage) || 10;
    this.applyFilters();
  }

  openNew(): void {
    this.isEditMode = false;
    this.selectedProveedor = null;
    this.showForm.set(true);
  }

  openEdit(proveedor: any): void {
    if (!proveedor?.idProveedor) {
      Swal.fire({
        icon: 'error',
        title: 'No se puede editar',
        text: 'El proveedor no tiene un identificador válido.',
        confirmButtonColor: '#1b6f6f'
      });
      return;
    }
    this.isEditMode = true;
    this.selectedProveedor = { ...proveedor };
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedProveedor = null;
  }

  onSaved(): void {
    this.closeForm();
    this.loadProveedores();
  }

  changeStatus(proveedor: any): void {
    const id = Number(proveedor?.idProveedor);
    if (!Number.isFinite(id) || id <= 0) return;

    const actual = String(proveedor?.estado ?? 'ACTIVO').toUpperCase();
    const nuevoEstado: 'ACTIVO' | 'INACTIVO' = actual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const accion = nuevoEstado === 'ACTIVO' ? 'activar' : 'desactivar';

    Swal.fire({
      title: `¿Deseas ${accion} este proveedor?`,
      html: `<strong>${this.escapeHtml(proveedor.empresa || 'Proveedor')}</strong>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: nuevoEstado === 'ACTIVO' ? '#16835b' : '#b93838',
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) return;
      this.loading.set(true);
      this.proveedorService.changeStatus(id, nuevoEstado).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: nuevoEstado === 'ACTIVO' ? 'Proveedor activado' : 'Proveedor desactivado',
            timer: 1400,
            showConfirmButton: false
          });
          this.loadProveedores();
        },
        error: (error) => {
          this.loading.set(false);
          console.error('Error al cambiar el estado del proveedor:', error);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo cambiar el estado',
            text: error?.error?.message || 'Verifica la conexión e inténtalo nuevamente.',
            confirmButtonColor: '#1b6f6f'
          });
        }
      });
    });
  }

  deleteProveedor(proveedor: any): void {
    const id = Number(proveedor?.idProveedor);
    if (!Number.isFinite(id) || id <= 0) return;

    Swal.fire({
      title: '¿Eliminar proveedor?',
      html: `Se eliminará <strong>${this.escapeHtml(proveedor.empresa || 'este proveedor')}</strong>.`,
      text: 'Si tiene compras asociadas, el servidor puede impedir la eliminación.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) return;
      this.loading.set(true);
      this.proveedorService.delete(id).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Proveedor eliminado', timer: 1400, showConfirmButton: false });
          this.loadProveedores();
        },
        error: (error) => {
          this.loading.set(false);
          console.error('Error al eliminar proveedor:', error);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo eliminar',
            text: error?.error?.message || 'Comprueba si el proveedor tiene movimientos o compras asociadas.',
            confirmButtonColor: '#1b6f6f'
          });
        }
      });
    });
  }

  verDetalle(proveedor: any): void {
    const fecha = proveedor?.fechaRegistro
      ? new Date(proveedor.fechaRegistro).toLocaleDateString('es-BO')
      : '—';
    const linea = (label: string, value: unknown) =>
      `<p><strong>${label}:</strong> ${this.escapeHtml(value || '—')}</p>`;

    Swal.fire({
      title: this.escapeHtml(proveedor?.empresa || 'Detalle del proveedor'),
      html: `<div class="proveedor-detalle" style="text-align:left;line-height:1.8">
        ${linea('Contacto', proveedor?.contacto)}
        ${linea('Correo', proveedor?.email)}
        ${linea('País', proveedor?.pais)}
        ${linea('Dirección', proveedor?.direccion)}
        ${linea('NIT / RUC', proveedor?.ruc ?? proveedor?.ciNit ?? proveedor?.nit)}
        ${linea('Estado', proveedor?.estado ?? 'ACTIVO')}
        ${linea('Registro', fecha)}
        ${linea('Observaciones', proveedor?.observaciones)}
      </div>`,
      icon: 'info',
      confirmButtonColor: '#1b6f6f',
      confirmButtonText: 'Cerrar',
      width: 560
    });
  }

  getStatusClass(estado: string): string {
    return String(estado ?? 'ACTIVO').toUpperCase() === 'ACTIVO' ? 'badge-success' : 'badge-danger';
  }

  getStatusText(estado: string): string {
    return String(estado ?? 'ACTIVO').toUpperCase() === 'ACTIVO' ? 'Activo' : 'Inactivo';
  }

  getPaginatedProveedores(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredProveedores().slice(start, start + this.itemsPerPage);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) this.currentPage = page;
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages()) this.currentPage++;
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const start = Math.max(1, Math.min(this.currentPage - 2, total - 4));
    const end = Math.min(total, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
