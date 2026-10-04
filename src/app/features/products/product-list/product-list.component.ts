import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs';
import { ProductService } from '../services/product.service';
import { CategoriaService } from '../services/Categoria.service';
import { UnidadMedidaService } from '../services/unidadMedida.servise';
import { ProductFormComponent } from '../product-form/product-form.component';
import Swal from 'sweetalert2';

// Interfaces para tipado fuerte
interface Categoria {
  idCategoria: number;
  nombre: string;
  color?: string;
  icono?: string;
}

interface UnidadMedida {
  idUnidad: number;
  nombre: string;
  abreviatura: string;
}

interface Product {
  idProducto?: number;
  articulo: string;
  descripcion?: string;
  precio: number;
  unidad: number;
  codigoBarras?: string;
  foto?: string;
  categoria?: Categoria;
  unidadMedida?: UnidadMedida;
}

interface DashboardStats {
  totalProductos: number;
  productosBajos: number;
  categorias: number;
  valorTotal: number;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css']
})
export class ProductListComponent implements OnInit, OnDestroy {
  private productSvc = inject(ProductService);
  private categoriaSvc = inject(CategoriaService);
  private unidadSvc = inject(UnidadMedidaService);

  // Signals para estado reactivo
  products = signal<Product[]>([]);
  filteredProducts = signal<Product[]>([]);
  loading = signal(false);
  loadingCatalogs = signal(false);

  // Filtros
  searchTerm = '';
  selectedCategory = 'Todas';
  selectedUnidad = 'Todas';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Catálogos
  categoriasDB = signal<Categoria[]>([]);
  unidadesDB = signal<UnidadMedida[]>([]);

  // Modal
  showForm = signal(false);
  selectedProduct: Product | null = null;
  isEditMode = false;

  // Estadísticas
  stats = signal<DashboardStats>({
    totalProductos: 0,
    productosBajos: 0,
    categorias: 0,
    valorTotal: 0
  });

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredProducts().length / this.itemsPerPage)));

  // Cache para colores de categorías
  private categoriaColorCache = new Map<string, string>();
  private categoriaIconCache = new Map<string, string>();
  Math: any;

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.loadCatalogs();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchTerm);
  }

  private loadCatalogs(): void {
    this.loadingCatalogs.set(true);

    Promise.all([
      this.categoriaSvc.getAll().toPromise(),
      this.unidadSvc.getAll().toPromise()
    ]).then(([categorias, unidades]) => {
      if (categorias) {
        this.categoriasDB.set(categorias);
        this.buildCategoryCache(categorias);
      }
      if (unidades) this.unidadesDB.set(unidades);
    }).catch(error => {
      console.error('Error loading catalogs:', error);
      Swal.fire({
        icon: 'warning',
        title: 'Error al cargar catálogos',
        text: 'No se pudieron cargar las categorías o unidades de medida'
      });
    }).finally(() => {
      this.loadingCatalogs.set(false);
    });
  }

  private buildCategoryCache(categorias: Categoria[]): void {
    categorias.forEach(cat => {
      if (cat.nombre) {
        this.categoriaColorCache.set(cat.nombre, cat.color || '#6b7280');
        this.categoriaIconCache.set(cat.nombre, cat.icono || 'fa-box');
      }
    });
  }

  loadProducts(): void {
    this.loading.set(true);
    this.productSvc.getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data: Product[]) => {
          this.products.set(data);
          this.calculateStats(data);
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error loading products:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error al cargar productos',
            text: 'No se pudieron cargar los productos. Verifica la conexión.'
          });
        }
      });
  }

  private calculateStats(products: Product[]): void {
    const categoriasSet = new Set<string>();
    let valorTotal = 0;
    let productosBajos = 0;

    products.forEach(p => {
      // Calcular valor total
      valorTotal += (p.precio || 0) * (p.unidad || 0);

      // Contar productos con stock bajo
      if ((p.unidad || 0) < 5) {
        productosBajos++;
      }

      // Contar categorías únicas
      if (p.categoria?.nombre) {
        categoriasSet.add(p.categoria.nombre);
      }
    });

    this.stats.set({
      totalProductos: products.length,
      productosBajos,
      categorias: categoriasSet.size,
      valorTotal
    });
  }

  applyFilters(): void {
    let filtered = [...this.products()];

    // Filtrar por categoría
    if (this.selectedCategory !== 'Todas') {
      filtered = filtered.filter(p => p.categoria?.nombre === this.selectedCategory);
    }

    // Filtrar por unidad de medida
    if (this.selectedUnidad !== 'Todas') {
      filtered = filtered.filter(p => p.unidadMedida?.nombre === this.selectedUnidad);
    }

    // Filtrar por término de búsqueda
    const searchTermLower = this.searchTerm.toLowerCase().trim();
    if (searchTermLower) {
      filtered = filtered.filter(p =>
        p.articulo?.toLowerCase().includes(searchTermLower) ||
        p.descripcion?.toLowerCase().includes(searchTermLower) ||
        p.codigoBarras?.toLowerCase().includes(searchTermLower) ||
        p.categoria?.nombre?.toLowerCase().includes(searchTermLower)
      );
    }

    this.filteredProducts.set(filtered);
    this.resetPagination();
  }

  private resetPagination(): void {
    this.currentPage = 1;
  }

  getPaginatedProducts(): Product[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredProducts().slice(start, end);
  }

  // Métodos de utilidad para la UI
  getCategoriaNombre(product: Product): string {
    return product.categoria?.nombre || '—';
  }

  getCategoriaColor(product: Product): string {
    if (!product.categoria?.nombre) return '#6b7280';
    return this.categoriaColorCache.get(product.categoria.nombre) || product.categoria.color || '#6b7280';
  }

  getCategoriaIcono(product: Product): string {
    if (!product.categoria?.nombre) return 'fa-box';
    return this.categoriaIconCache.get(product.categoria.nombre) || product.categoria.icono || 'fa-box';
  }

  getUnidadNombre(product: Product): string {
    return product.unidadMedida?.abreviatura || product.unidadMedida?.nombre || '—';
  }

  getStockClass(stock: number): string {
    if (stock === 0) return 'stock-cero';
    if (stock < 5) return 'stock-bajo';
    return 'stock-ok';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-BO').format(value || 0);
  }

  // Acciones de productos
  openNew(): void {
    this.selectedProduct = null;
    this.isEditMode = false;
    this.showForm.set(true);
  }

// En product-list.component.ts, asegurar que openEdit clona el producto correctamente
  openEdit(product: Product): void {
    console.log('Abriendo edición para producto:', product);
    // Clonar profundamente el producto para evitar referencias
    this.selectedProduct = JSON.parse(JSON.stringify(product));
    this.isEditMode = true;
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedProduct = null;
  }

  onProductSaved(): void {
    this.closeForm();
    this.loadProducts();
  }

  async deleteProduct(product: Product): Promise<void> {
    const result = await Swal.fire({
      title: '¿Eliminar producto?',
      html: `¿Seguro que deseas eliminar <b>${product.articulo}</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed && product.idProducto) {
      this.loading.set(true);
      this.productSvc.delete(product.idProducto)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Eliminado',
              text: 'El producto ha sido eliminado correctamente',
              timer: 1500,
              showConfirmButton: false
            });
            this.loadProducts();
          },
          error: (error) => {
            console.error('Error deleting product:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error al eliminar',
              text: error?.error?.message || 'No se pudo eliminar el producto'
            });
          }
        });
    }
  }

  changeStock(product: Product, delta: number): void {
    if (!product.idProducto) return;

    const currentStock = product.unidad || 0;
    const newStock = Math.max(0, currentStock + delta);

    if (currentStock === newStock && delta < 0) return; // No puede ser negativo

    const updatedProduct = {
      ...product,
      unidad: newStock,
      categoria: product.categoria?.idCategoria,
      unidadMedida: product.unidadMedida?.idUnidad
    };

    this.productSvc.update(product.idProducto, updatedProduct)
      .subscribe({
        next: () => {
          // Actualizar localmente para UI más rápida
          const updatedProducts = this.products().map(p =>
            p.idProducto === product.idProducto ? { ...p, unidad: newStock } : p
          );
          this.products.set(updatedProducts);
          this.calculateStats(updatedProducts);
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error updating stock:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error al actualizar stock',
            text: error?.error?.message || 'No se pudo actualizar el stock',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
          });
        }
      });
  }

  // Métodos de paginación
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage = page;
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
    const total = this.totalPages();
    const current = this.currentPage;
    const delta = 2;
    const range = [];
    const rangeWithDots: (string | number)[] = [];
    let l: number;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots.filter(p => p !== '...') as number[];
  }

  // Exportar datos
  exportToCSV(): void {
    const products = this.filteredProducts();
    if (products.length === 0) {
      Swal.fire('Sin datos', 'No hay productos para exportar', 'warning');
      return;
    }

    const headers = ['ID', 'Artículo', 'Descripción', 'Categoría', 'Unidad', 'Precio', 'Stock', 'Código Barras'];
    const csvData = products.map(p => [
      p.idProducto,
      p.articulo,
      p.descripcion || '',
      p.categoria?.nombre || '',
      this.getUnidadNombre(p),
      p.precio,
      p.unidad,
      p.codigoBarras || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Swal.fire({
      icon: 'success',
      title: 'Exportado',
      text: `${products.length} productos exportados correctamente`,
      timer: 1500,
      showConfirmButton: false
    });
  }
}
