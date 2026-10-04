import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProveedorService } from '../service/proveedor.service';
import { ProveedorFormComponent } from '../proveedor-form/proveedor-form.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-proveedor-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ProveedorFormComponent],
  templateUrl: './proveedor-list.component.html',
  styleUrls: ['./proveedor-list.component.css']
})
export class ProveedorListComponent implements OnInit {
  viewClient(arg0: any[]) {
      throw new Error('Method not implemented.');
  }
  proveedor(): any {
      throw new Error('Method not implemented.');
  }
  private proveedorService = inject(ProveedorService);

  proveedores = signal<any[]>([]);
  filteredProveedores = signal<any[]>([]);
  loading = signal(false);
  showForm = signal(false);
  selectedProveedor: any = null;
  isEditMode = false;
  searchTerm = '';
  filtroPais = 'TODOS';
  filtroEstado = 'TODOS';

  paisesDisponibles = signal<string[]>([]);
  stats = signal({ total: 0, activos: 0, inactivos: 0 });

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = signal(1);
  Math = Math;

  ngOnInit(): void {
    this.loadProveedores();
  }

  loadProveedores(): void {
    this.loading.set(true);
    console.log('🔄 Cargando proveedores...');

    this.proveedorService.getAll().subscribe({
      next: (data: any[]) => {
        console.log('✅ Proveedores recibidos:', data);

        if (!data || !Array.isArray(data)) {
          console.error('❌ Datos inválidos:', data);
          this.proveedores.set([]);
          this.loading.set(false);
          return;
        }

        this.proveedores.set(data);

        // Extraer países únicos
        const paises = [...new Set(data.map(p => p.pais).filter(p => p))];
        this.paisesDisponibles.set(paises);
        console.log('📋 Países encontrados:', paises);

        this.calcStats(data);
        this.applyFilters();
        this.loading.set(false);
      },
      error: (error) => {
        console.error('❌ Error al cargar proveedores:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los proveedores. Verifica la conexión con el backend.'
        });
        this.loading.set(false);
      }
    });
  }

  calcStats(proveedores: any[]): void {
    this.stats.set({
      total: proveedores.length,
      activos: proveedores.filter(p => p.estado === 'ACTIVO').length,
      inactivos: proveedores.filter(p => p.estado === 'INACTIVO').length
    });
    console.log('📊 Estadísticas:', this.stats());
  }

  applyFilters(): void {
    let result = [...this.proveedores()];

    // Filtro por búsqueda
    const term = this.searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(p =>
        p.empresa?.toLowerCase().includes(term) ||
        p.contacto?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.ruc?.includes(term) ||
        p.pais?.toLowerCase().includes(term)
      );
    }

    // Filtro por país
    if (this.filtroPais !== 'TODOS') {
      result = result.filter(p => p.pais === this.filtroPais);
    }

    // Filtro por estado
    if (this.filtroEstado !== 'TODOS') {
      result = result.filter(p => p.estado === this.filtroEstado);
    }

    this.filteredProveedores.set(result);
    this.totalPages.set(Math.ceil(result.length / this.itemsPerPage) || 1);
    this.currentPage = 1;
    console.log(`🔍 Filtro aplicado: ${this.filteredProveedores().length} proveedores`);
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

  openNew(): void {
    this.isEditMode = false;
    this.selectedProveedor = null;
    this.showForm.set(true);
  }

  openEdit(p: any): void {
    this.isEditMode = true;
    this.selectedProveedor = p;
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

  // CORREGIDO: Método changeStatus con un solo parámetro
  changeStatus(p: any, p0: string): void {
    const nuevoEstado = p.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const estadoTexto = nuevoEstado === 'ACTIVO' ? 'activar' : 'desactivar';

    Swal.fire({
      title: `¿${estadoTexto.charAt(0).toUpperCase() + estadoTexto.slice(1)} proveedor?`,
      html: `¿Estás seguro de ${estadoTexto} a <strong>${p.empresa}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: nuevoEstado === 'ACTIVO' ? '#10b981' : '#ef4444',
      confirmButtonText: `Sí, ${estadoTexto}`,
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed && p.idProveedor) {
        this.proveedorService.changeStatus(p.idProveedor, nuevoEstado).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: `Proveedor ${nuevoEstado === 'ACTIVO' ? 'activado' : 'desactivado'}`,
              timer: 1500,
              showConfirmButton: false
            });
            this.loadProveedores();
          },
          error: (err) => {
            console.error('Error cambiando estado:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: err.error?.message || 'No se pudo actualizar el estado del proveedor'
            });
          }
        });
      }
    });
  }

  deleteProveedor(p: any): void {
    Swal.fire({
      title: '¿Eliminar proveedor?',
      html: `¿Estás seguro de eliminar a <strong>${p.empresa}</strong>?<br><small>Esta acción no se puede deshacer</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed && p.idProveedor) {
        this.proveedorService.delete(p.idProveedor).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Proveedor eliminado',
              timer: 1500,
              showConfirmButton: false
            });
            this.loadProveedores();
          },
          error: (err) => {
            console.error('Error eliminando proveedor:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: err.error?.message || 'No se pudo eliminar el proveedor'
            });
          }
        });
      }
    });
  }

  verDetalle(p: any): void {
    Swal.fire({
      title: p.empresa,
      html: `
        <div style="text-align:left;padding:8px;font-size:14px">
          <p><strong>📧 Contacto:</strong> ${p.contacto}</p>
          <p><strong>📧 Email:</strong> ${p.email}</p>
          <p><strong>🌍 País:</strong> ${p.pais || '---'}</p>
          <p><strong>📍 Dirección:</strong> ${p.direccion || '---'}</p>
          ${p.ruc ? `<p><strong>📄 RUC:</strong> ${p.ruc}</p>` : ''}
          ${p.observaciones ? `<p><strong>📝 Observaciones:</strong> ${p.observaciones}</p>` : ''}
          <p><strong>📅 Registro:</strong> ${p.fechaRegistro ? new Date(p.fechaRegistro).toLocaleDateString('es-BO') : '---'}</p>
        </div>
      `,
      icon: 'info',
      confirmButtonColor: '#1b6f6f',
      confirmButtonText: 'Cerrar'
    });
  }

  getStatusClass(estado: string): string {
    return estado === 'ACTIVO' ? 'badge-success' : 'badge-danger';
  }

  getStatusText(estado: string): string {
    return estado === 'ACTIVO' ? '✓ Activo' : '✗ Inactivo';
  }

  getPaginatedProveedores(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredProveedores().slice(start, start + this.itemsPerPage);
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) {
      this.currentPage = p;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages();
    const start = Math.max(1, this.currentPage - 2);
    for (let i = start; i <= Math.min(total, start + 4); i++) {
      pages.push(i);
    }
    return pages;
  }
}
