import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable, of } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import { ExistingService } from '../services/existing.service';
import { ProductService } from '../../products/services/product.service';
import { MovementsService } from '../services/movements.service';
import Swal from 'sweetalert2';

interface CategoryData {
  idCategoria?: number;
  nombre?: string;
}

interface ProductData {
  idProducto?: number;
  articulo?: string;
  descripcion?: string;
  unidad?: number;
  precio?: number;
  codigoBarras?: string;
  categoria?: CategoryData | string | null;
}

interface StockItem {
  idExisting?: number;
  stockACtual: number;
  stockMinimo: number;
  product: ProductData;
  virtual?: boolean;
}

interface MovementData {
  idMovements?: number;
  cantidad?: number;
  fecha?: string;
  tipo?: string;
  responsable?: string;
  observaciones?: string;
  product?: ProductData;
}

@Component({
  selector: 'app-existing-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './existing-list.component.html',
  styleUrls: ['./existing-list.component.css']
})
export class ExistingListComponent implements OnInit {
  private existingService = inject(ExistingService);
  private productService = inject(ProductService);
  private movementsService = inject(MovementsService);

  existing = signal<StockItem[]>([]);
  allExisting = signal<StockItem[]>([]);
  products = signal<ProductData[]>([]);
  loading = signal(true);

  searchTerm = '';
  statusFilter = '';
  categoryFilter = 'Todas';

  totalItems = signal(0);
  normalItems = signal(0);
  lowStockItems = signal(0);
  criticalItems = signal(0);
  totalValue = signal(0);

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = signal(1);
  Math = Math;

  showEditModal = signal(false);
  editingItem: StockItem | null = null;
  newStockMinimo = 5;
  savingMinimum = signal(false);

  showAdjustModal = signal(false);
  adjustmentProductId: number | null = null;
  adjustmentType: 'ENTRADA' | 'SALIDA' = 'ENTRADA';
  adjustmentQuantity = 1;
  adjustmentReason = '';
  adjustmentResponsible = '';
  savingAdjustment = signal(false);

  showHistoryModal = signal(false);
  loadingHistory = signal(false);
  movements = signal<MovementData[]>([]);
  historySearch = '';
  historyType = '';
  historyFrom = '';
  historyTo = '';
  historyProductId: number | null = null;

  private categoryColors: Record<string, string> = {
    ONU: '#7c3aed',
    CABLE_GPON: '#0d9488',
    CONECTORES: '#f59e0b',
    CAJAS_EMPALME: '#3b82f6',
    HERRAMIENTAS: '#10b981',
    OTROS: '#64748b'
  };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    forkJoin({
      stock: this.existingService.getAll(),
      products: this.productService.getAll()
    }).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: ({ stock, products }) => {
        this.products.set(products as ProductData[]);
        const recordsByProduct = new Map<number, any>();

        (stock ?? []).forEach((record: any) => {
          const productId = Number(record.product?.idProducto ?? record.productId);
          if (productId) recordsByProduct.set(productId, record);
        });

        const rows: StockItem[] = (products ?? []).map((product: any) => {
          const productId = Number(product.idProducto);
          const record = recordsByProduct.get(productId);
          if (record) {
            recordsByProduct.delete(productId);
            return {
              ...record,
              product,
              stockACtual: Number(record.stockACtual ?? product.unidad ?? 0),
              stockMinimo: Number(record.stockMinimo ?? 5),
              virtual: false
            } as StockItem;
          }

          return {
            stockACtual: Number(product.unidad ?? 0),
            stockMinimo: 5,
            product,
            virtual: true
          } as StockItem;
        });

        (stock ?? []).forEach((record: any) => {
          const productId = Number(record.product?.idProducto ?? record.productId);
          if (recordsByProduct.has(productId) && record.product) {
            rows.push({
              ...record,
              stockACtual: Number(record.stockACtual ?? 0),
              stockMinimo: Number(record.stockMinimo ?? 5),
              virtual: false
            } as StockItem);
            recordsByProduct.delete(productId);
          }
        });

        this.allExisting.set(rows);
        this.calculateStats(rows);
        this.applyFilter();
      },
      error: (error) => {
        console.error('Error al cargar el stock:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar stock',
          text: 'No se pudieron cargar los productos y sus existencias.'
        });
      }
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLocaleLowerCase();
    let filtered = [...this.allExisting()];

    if (term) {
      filtered = filtered.filter(item => {
        const article = item.product?.articulo?.toLocaleLowerCase() ?? '';
        const code = item.product?.codigoBarras?.toLocaleLowerCase() ?? '';
        const category = this.getCategoryName(item).toLocaleLowerCase();
        const description = item.product?.descripcion?.toLocaleLowerCase() ?? '';
        return article.includes(term) || code.includes(term) || category.includes(term) || description.includes(term);
      });
    }

    if (this.statusFilter) {
      filtered = filtered.filter(item => this.getStockStatus(item) === this.statusFilter);
    }

    if (this.categoryFilter !== 'Todas') {
      filtered = filtered.filter(item => this.getCategoryName(item) === this.categoryFilter);
    }

    this.existing.set(filtered);
    this.totalPages.set(Math.max(1, Math.ceil(filtered.length / this.itemsPerPage)));
    this.currentPage = Math.min(this.currentPage, this.totalPages());
    if (this.currentPage < 1) this.currentPage = 1;
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilter();
  }

  calculateStats(data: StockItem[]): void {
    this.totalItems.set(data.length);
    this.normalItems.set(data.filter(item => this.getStockStatus(item) === 'normal').length);
    this.lowStockItems.set(data.filter(item => this.getStockStatus(item) === 'low').length);
    this.criticalItems.set(data.filter(item => this.getStockStatus(item) === 'critical').length);
    this.totalValue.set(data.reduce((sum, item) => {
      return sum + (item.stockACtual * Number(item.product?.precio ?? 0));
    }, 0));
  }

  getStockStatus(item: StockItem): 'normal' | 'low' | 'critical' {
    const actual = Number(item.stockACtual ?? 0);
    const minimum = Number(item.stockMinimo ?? 0);
    if (actual <= 0) return 'critical';
    if (actual <= minimum) return 'low';
    return 'normal';
  }

  getStockStatusText(item: StockItem): string {
    const status = this.getStockStatus(item);
    if (status === 'critical') return 'Sin stock';
    if (status === 'low') return 'Stock bajo';
    return 'Normal';
  }

  getStockPercent(item: StockItem): number {
    const actual = Math.max(0, Number(item.stockACtual ?? 0));
    const minimum = Math.max(1, Number(item.stockMinimo ?? 0));
    return Math.min(100, Math.round((actual / (minimum * 2)) * 100));
  }

  getCategoryName(item: StockItem | ProductData | null | undefined): string {
    const value: any = item as any;
    const category = value?.product?.categoria ?? value?.categoria;
    if (typeof category === 'string') return category || 'Sin categoría';
    return category?.nombre || 'Sin categoría';
  }

  getCategoryColor(category: string | null | undefined): string {
    return this.categoryColors[category ?? ''] ?? '#1b6f6f';
  }

  getCategories(): Array<{ name: string; count: number; value: number }> {
    const categories = new Map<string, { count: number; value: number }>();
    this.allExisting().forEach(item => {
      const name = this.getCategoryName(item);
      const current = categories.get(name) ?? { count: 0, value: 0 };
      categories.set(name, {
        count: current.count + 1,
        value: current.value + item.stockACtual * Number(item.product?.precio ?? 0)
      });
    });
    return Array.from(categories.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getPaginatedItems(): StockItem[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.existing().slice(start, start + this.itemsPerPage);
  }

  openEdit(item: StockItem): void {
    this.editingItem = item;
    this.newStockMinimo = Number(item.stockMinimo ?? 5);
    this.showEditModal.set(true);
  }

  saveEdit(): void {
    const item = this.editingItem;
    const minimum = Number(this.newStockMinimo);

    if (!item?.product?.idProducto) {
      Swal.fire({ icon: 'warning', title: 'Producto inválido', text: 'No se identifica el producto seleccionado.' });
      return;
    }
    if (!Number.isInteger(minimum) || minimum < 0) {
      Swal.fire({ icon: 'warning', title: 'Mínimo inválido', text: 'El stock mínimo debe ser un número entero igual o mayor a cero.' });
      return;
    }

    this.savingMinimum.set(true);
    const saveRequest = item.idExisting
      ? this.existingService.update(item.idExisting, {
        stockACtual: item.stockACtual,
        stockMinimo: minimum
      })
      : this.ensureExisting(item, minimum);

    saveRequest.pipe(finalize(() => this.savingMinimum.set(false))).subscribe({
      next: () => {
        this.showEditModal.set(false);
        this.editingItem = null;
        this.loadData();
        Swal.fire({ icon: 'success', title: 'Stock mínimo actualizado', timer: 1500, showConfirmButton: false });
      },
      error: (error) => {
        console.error('Error al actualizar el stock mínimo:', error);
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error?.error?.message || 'Intenta nuevamente.' });
      }
    });
  }

  openAdjustment(item?: StockItem): void {
    this.adjustmentProductId = item?.product?.idProducto ?? null;
    this.adjustmentType = 'ENTRADA';
    this.adjustmentQuantity = 1;
    this.adjustmentReason = '';
    this.adjustmentResponsible = '';
    this.showAdjustModal.set(true);
  }

  saveAdjustment(): void {
    const selectedId = Number(this.adjustmentProductId);
    const item = this.allExisting().find(row => Number(row.product?.idProducto) === selectedId);
    const quantity = Number(this.adjustmentQuantity);
    const responsible = this.adjustmentResponsible.trim();
    const reason = this.adjustmentReason.trim();

    if (!item?.product?.idProducto) {
      Swal.fire({ icon: 'warning', title: 'Selecciona un producto' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      Swal.fire({ icon: 'warning', title: 'Cantidad inválida', text: 'Ingresa una cantidad entera mayor que cero.' });
      return;
    }
    if (this.adjustmentType === 'SALIDA' && quantity > item.stockACtual) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock insuficiente',
        text: `Disponible: ${item.stockACtual}. Solicitado: ${quantity}.`
      });
      return;
    }
    if (!responsible) {
      Swal.fire({ icon: 'warning', title: 'Falta el responsable', text: 'Registra quién realizó el ajuste.' });
      return;
    }
    if (!reason) {
      Swal.fire({ icon: 'warning', title: 'Falta el motivo', text: 'Describe por qué se realiza el ajuste.' });
      return;
    }

    this.savingAdjustment.set(true);
    this.ensureExisting(item).pipe(
      switchMap(() => this.movementsService.create({
        idProducto: item.product.idProducto,
        cantidad: quantity,
        tipo: this.adjustmentType,
        responsable: responsible,
        observaciones: `AJUSTE MANUAL: ${reason}`
      })),
      finalize(() => this.savingAdjustment.set(false))
    ).subscribe({
      next: () => {
        this.showAdjustModal.set(false);
        this.loadData();
        if (this.showHistoryModal()) this.loadHistory();
        Swal.fire({
          icon: 'success',
          title: 'Ajuste registrado',
          text: 'El stock fue actualizado y el movimiento quedó guardado en el historial.',
          timer: 1900,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error al registrar el ajuste:', error);
        Swal.fire({
          icon: 'error',
          title: 'No se pudo registrar el ajuste',
          text: error?.error?.message || 'Verifica el stock disponible e inténtalo de nuevo.'
        });
      }
    });
  }

  private ensureExisting(item: StockItem, minimum = item.stockMinimo): Observable<StockItem> {
    if (item.idExisting) return of(item);

    return this.existingService.create({
      stockACtual: Number(item.stockACtual ?? 0),
      stockMinimo: Number(minimum ?? 5),
      productId: item.product.idProducto
    }).pipe(
      map((created: any) => ({
        ...item,
        ...created,
        product: item.product,
        stockACtual: Number(created?.stockACtual ?? item.stockACtual ?? 0),
        stockMinimo: Number(created?.stockMinimo ?? minimum ?? 5),
        virtual: false
      } as StockItem)),
      tap((created: StockItem) => {
        item.idExisting = created.idExisting;
        item.stockACtual = created.stockACtual;
        item.stockMinimo = created.stockMinimo;
        item.virtual = false;
      })
    );
  }

  openHistory(item?: StockItem): void {
    this.historyProductId = item?.product?.idProducto ?? null;
    this.historySearch = '';
    this.historyType = '';
    this.historyFrom = '';
    this.historyTo = '';
    this.showHistoryModal.set(true);
    this.loadHistory();
  }

  loadHistory(): void {
    this.loadingHistory.set(true);
    this.movementsService.getAll().pipe(
      finalize(() => this.loadingHistory.set(false))
    ).subscribe({
      next: (data: MovementData[]) => this.movements.set([...(data ?? [])].sort((a, b) => {
        return this.getDateString(b.fecha).localeCompare(this.getDateString(a.fecha)) ||
          Number(b.idMovements ?? 0) - Number(a.idMovements ?? 0);
      })),
      error: (error) => {
        console.error('Error al cargar el historial:', error);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el historial de existencias.' });
      }
    });
  }

  getFilteredMovements(): MovementData[] {
    const term = this.historySearch.trim().toLocaleLowerCase();
    return this.movements().filter(movement => {
      const productId = Number(movement.product?.idProducto ?? 0);
      if (this.historyProductId !== null && productId !== Number(this.historyProductId)) return false;
      if (this.historyType && (movement.tipo ?? '').toUpperCase() !== this.historyType) return false;

      const date = this.getDateString(movement.fecha);
      if (this.historyFrom && date && date < this.historyFrom) return false;
      if (this.historyTo && date && date > this.historyTo) return false;

      if (term) {
        const searchable = [
          movement.product?.articulo,
          movement.responsable,
          movement.observaciones,
          movement.tipo,
          movement.idMovements
        ].map(value => String(value ?? '').toLocaleLowerCase()).join(' ');
        if (!searchable.includes(term)) return false;
      }
      return true;
    });
  }

  clearHistoryProductFilter(): void {
    this.historyProductId = null;
  }

  exportStockCSV(): void {
    const rows = this.existing().map(item => [
      item.product?.idProducto ?? '',
      item.product?.articulo ?? '',
      this.getCategoryName(item),
      item.stockACtual,
      item.stockMinimo,
      this.getStockStatusText(item),
      Number(item.product?.precio ?? 0).toFixed(2),
      (item.stockACtual * Number(item.product?.precio ?? 0)).toFixed(2)
    ]);
    if (!rows.length) {
      Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay existencias que coincidan con los filtros.' });
      return;
    }

    this.downloadCsv(`reporte_stock_${this.today()}.csv`, [
      ['ID Producto', 'Producto', 'Categoría', 'Stock actual', 'Stock mínimo', 'Estado', 'Precio unitario (Bs)', 'Valor en stock (Bs)'],
      ...rows
    ]);
    Swal.fire({ icon: 'success', title: 'Reporte de stock exportado', text: `${rows.length} productos incluidos.`, timer: 1600, showConfirmButton: false });
  }

  exportHistoryCSV(): void {
    const rows = this.getFilteredMovements().map(movement => [
      movement.idMovements ?? '',
      this.formatDate(movement.fecha),
      (movement.tipo ?? '').toUpperCase(),
      movement.product?.articulo ?? '',
      movement.cantidad ?? 0,
      movement.responsable ?? '',
      movement.observaciones ?? ''
    ]);
    if (!rows.length) {
      Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay movimientos que coincidan con los filtros.' });
      return;
    }

    this.downloadCsv(`historial_existencias_${this.today()}.csv`, [
      ['ID Movimiento', 'Fecha', 'Tipo', 'Producto', 'Cantidad', 'Responsable', 'Observaciones'],
      ...rows
    ]);
    Swal.fire({ icon: 'success', title: 'Historial exportado', text: `${rows.length} movimientos incluidos.`, timer: 1600, showConfirmButton: false });
  }

  private downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
    const escape = (value: string | number): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = '\ufeff' + rows.map(row => row.map(escape).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value ?? 0));
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
  }

  private getDateString(value?: string): string {
    return value ? String(value).slice(0, 10) : '';
  }

  private today(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(total, start + 4);
    const pages: number[] = [];
    for (let page = start; page <= end; page++) pages.push(page);
    return pages;
  }

  onItemsPerPageChange(): void {
    this.currentPage = 1;
    this.applyFilter();
  }
}
