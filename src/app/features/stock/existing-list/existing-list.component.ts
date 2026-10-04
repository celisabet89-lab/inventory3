import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExistingService } from '../services/existing.service';
import { ProductService } from '../../products/services/product.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-existing-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './existing-list.component.html',
  styleUrls: ['./existing-list.component.css']
})
export class ExistingListComponent implements OnInit {
  private existingService = inject(ExistingService);
  private productService  = inject(ProductService);

  existing      = signal<any[]>([]);
  allExisting   = signal<any[]>([]);
  products      = signal<any[]>([]);
  loading       = signal(true);

  searchTerm   = '';
  statusFilter = '';

  // Stats
  totalItems    = signal(0);
  normalItems   = signal(0);
  lowStockItems = signal(0);
  criticalItems = signal(0);
  totalValue    = signal(0);

  // Paginación
  currentPage  = 1;
  itemsPerPage = 10;
  totalPages   = signal(1);
  Math         = Math;

  // Modal editar
  showEditModal  = signal(false);
  editingItem: any = null;
  newStockActual = 0;
  newStockMinimo = 0;

  // Modal nuevo
  showNewModal       = signal(false);
  selectedProductId: number | null = null;
  newStockValue      = 0;
  newStockMin        = 5;

  // Colores por categoría
  private categoryColors: Record<string, string> = {
    'ONU':          '#7c3aed',
    'CABLE_GPON':   '#0d9488',
    'CONECTORES':   '#f59e0b',
    'CAJAS_EMPALME':'#3b82f6',
    'HERRAMIENTAS': '#10b981',
    'OTROS':        '#64748b'
  };

  ngOnInit(): void {
    this.loadExisting();
    this.loadProducts();
  }

  loadExisting(): void {
    this.loading.set(true);
    this.existingService.getAll().subscribe({
      next: (data: any[]) => {
        this.allExisting.set(data);
        this.applyFilter();
        this.calculateStats(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el stock' });
      }
    });
  }

  loadProducts(): void {
    this.productService.getAll().subscribe({
      next: (data: any[]) => this.products.set(data),
      error: () => {}
    });
  }

  applyFilter(): void {
    let result = [...this.allExisting()];

    // Filtro de búsqueda
    const term = this.searchTerm.toLowerCase().trim();
    if (term) result = result.filter(i =>
      i.product?.articulo?.toLowerCase().includes(term) ||
      i.product?.categoria?.toLowerCase().includes(term)
    );

    // Filtro de estado
    if (this.statusFilter) {
      result = result.filter(i => this.getStockStatus(i) === this.statusFilter);
    }

    this.existing.set(result);
    this.totalPages.set(Math.ceil(result.length / this.itemsPerPage) || 1);
    this.currentPage = 1;
  }

  onSearchChange(): void { this.applyFilter(); }

  calculateStats(data: any[]): void {
    const normal   = data.filter(i => this.getStockStatus(i) === 'normal').length;
    const low      = data.filter(i => this.getStockStatus(i) === 'low').length;
    const critical = data.filter(i => this.getStockStatus(i) === 'critical').length;
    const value    = data.reduce((s, i) => s + ((i.stockACtual ?? 0) * (i.product?.precio ?? 0)), 0);
    this.totalItems.set(data.length);
    this.normalItems.set(normal);
    this.lowStockItems.set(low);
    this.criticalItems.set(critical);
    this.totalValue.set(value);
  }

  getStockStatus(item: any): string {
    const actual = item.stockACtual ?? 0;
    const min    = item.stockMinimo ?? 0;
    if (actual === 0)         return 'critical';
    if (actual <= min)        return 'low';
    return 'normal';
  }

  getStockStatusText(item: any): string {
    return { normal: '✓ Normal', low: '⚠ Bajo', critical: '✕ Sin Stock' }[this.getStockStatus(item)] ?? 'Normal';
  }

  getStockPercent(item: any): number {
    const actual = item.stockACtual ?? 0;
    const min    = item.stockMinimo ?? 1;
    return Math.min(100, Math.round((actual / (min * 2)) * 100));
  }

  getCategoryColor(categoria: string): string {
    return this.categoryColors[categoria] ?? '#64748b';
  }

  getPaginatedItems(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.existing().slice(start, start + this.itemsPerPage);
  }

  getCategories(): any[] {
    const map = new Map<string, { count: number; value: number }>();
    this.allExisting().forEach(i => {
      const cat = i.product?.categoria ?? 'Sin categoría';
      const val = (i.stockACtual ?? 0) * (i.product?.precio ?? 0);
      const cur = map.get(cat) ?? { count: 0, value: 0 };
      map.set(cat, { count: cur.count + 1, value: cur.value + val });
    });
    return Array.from(map.entries()).map(([name, s]) => ({ name, ...s }));
  }

  openEdit(item: any): void {
    this.editingItem    = item;
    this.newStockActual = item.stockACtual ?? 0;
    this.newStockMinimo = item.stockMinimo ?? 0;
    this.showEditModal.set(true);
  }

  saveEdit(): void {
    if (!this.editingItem) return;
    this.existingService.update(this.editingItem.idExisting, {
      stockACtual: this.newStockActual,
      stockMinimo: this.newStockMinimo
    }).subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: 'Stock actualizado', timer: 1500, showConfirmButton: false });
        this.showEditModal.set(false);
        this.loadExisting();
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el stock' })
    });
  }

  openNew(): void {
    this.selectedProductId = null;
    this.newStockValue     = 0;
    this.newStockMin       = 5;
    this.showNewModal.set(true);
  }

  saveNew(): void {
    if (!this.selectedProductId) {
      Swal.fire({ icon: 'warning', title: 'Selecciona un producto' }); return;
    }
    this.existingService.create({
      stockACtual: this.newStockValue,
      stockMinimo: this.newStockMin,
      productId:   this.selectedProductId
    }).subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: 'Registro creado', timer: 1500, showConfirmButton: false });
        this.showNewModal.set(false);
        this.loadExisting();
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo crear el registro' })
    });
  }

  deleteExisting(item: any): void {
    Swal.fire({
      title: '¿Eliminar registro?',
      html: `Stock de <strong>${item.product?.articulo ?? 'producto'}</strong>`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed) {
        this.existingService.delete(item.idExisting).subscribe({
          next: () => { Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false }); this.loadExisting(); },
          error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar' })
        });
      }
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(v ?? 0);
  }

  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages()) this.currentPage = p; }
  previousPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages()) this.currentPage++; }
  getPageNumbers(): number[] {
    const pages: number[] = []; const start = Math.max(1, this.currentPage - 2);
    for (let i = start; i <= Math.min(this.totalPages(), start + 4); i++) pages.push(i);
    return pages;
  }
}
