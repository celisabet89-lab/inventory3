import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MovementsService } from '../services/movements.service';
import { ProductService, ProductRequest } from '../../products/services/product.service';
import { Product } from '../../../models/product.model';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: 'movements-list.component.html',
  styleUrls: ['movements-list.component.css']
})
export class MovementsListComponent implements OnInit {
  private productService   = inject(ProductService);
  private movementsService = inject(MovementsService);
  private fb               = inject(FormBuilder);
  private router = inject(Router);
  abrirReporteGeneral(): void {
    this.router.navigate(['/stock/movements/report']);
  }

  products         = signal<Product[]>([]);
  filteredProducts = signal<Product[]>([]);
  loadingProducts  = signal(true);
  loading          = signal(false);

  tipoMovimiento: 'entrada' | 'salida' = 'entrada';
  productSearch = '';
  detalle: DetalleItem[] = [];
  nextSeq = 1;

  movForm!: FormGroup;
  today = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
    this.initForm();
    this.loadProducts();
  }

  // ─── TIPO ────────────────────────────────────────────────────
  setTipo(tipo: 'entrada' | 'salida'): void {
    if (tipo === this.tipoMovimiento) return;
    if (this.detalle.length > 0) {
      Swal.fire({
        title: '¿Cambiar tipo?',
        text: 'Se limpiará el detalle actual.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: tipo === 'entrada' ? '#1b6f6f' : '#4f46e5',
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'No'
      }).then(r => {
        if (r.isConfirmed) { this.tipoMovimiento = tipo; this.resetForm(false); }
      });
    } else {
      this.tipoMovimiento = tipo;
      this.resetForm(false);
    }
  }

  // ─── FORM ────────────────────────────────────────────────────
  initForm(): void {
    this.movForm = this.fb.group({
      codigo:      [{ value: this.generateCodigo(), disabled: true }],
      fecha:       [this.today, Validators.required],
      contraparte: ['', Validators.required],
      fechaLimite: [''],
      nitCi:       [''],
      formaPago:   ['CONTADO', Validators.required],
      tipoMoneda:  ['BOLIVIANOS', Validators.required],
      glosa:       ['']
    });
  }

  generateCodigo(): string {
    const prefix = this.tipoMovimiento === 'entrada' ? 'C' : 'V';
    return prefix + String(Date.now()).slice(-5);
  }

  // ─── PRODUCTOS ───────────────────────────────────────────────
  loadProducts(): void {
    this.loadingProducts.set(true);
    this.productService.getAll().subscribe({
      next: (data: Product[]) => {
        this.products.set(data);
        this.filteredProducts.set(data);
        this.loadingProducts.set(false);
      },
      error: () => {
        this.loadingProducts.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los productos' });
      }
    });
  }

  onProductSearch(): void {
    const term = this.productSearch.toLowerCase().trim();
    if (!term) { this.filteredProducts.set(this.products()); return; }
    this.filteredProducts.set(
      this.products().filter(p =>
        p.articulo?.toLowerCase().includes(term) ||
        p.descripcion?.toLowerCase().includes(term) ||
        p.codigoQR?.toLowerCase().includes(term) ||
        p.codigoBarras?.toLowerCase().includes(term)
      )
    );
  }

  // ─── STOCK HELPERS ───────────────────────────────────────────
  getStockDisponible(p: Product): number {
    const enDetalle = this.detalle
      .filter(d => d.idProducto === p.idProducto!)
      .reduce((acc, d) => acc + d.cantidad, 0);
    return (p.unidad ?? 0) - enDetalle;
  }

  getStockClass(p: Product): string {
    const s = this.getStockDisponible(p);
    if (s <= 0)  return 'stock-zero';
    if (s <= 5)  return 'stock-low';
    return 'stock-ok';
  }

  // ─── DETALLE ─────────────────────────────────────────────────
  addProducto(p: Product): void {
    if (this.tipoMovimiento === 'salida' && this.getStockDisponible(p) <= 0) {
      Swal.fire({ icon: 'warning', title: 'Sin stock',
        text: `No hay stock disponible para "${p.articulo}"`,
        timer: 1500, showConfirmButton: false });
      return;
    }
    const existing = this.detalle.find(d => d.idProducto === p.idProducto!);
    if (existing) {
      if (this.tipoMovimiento === 'salida' && this.getStockDisponible(p) <= 0) return;
      existing.cantidad++;
      this.recalcItem(existing);
      return;
    }
    const precio = p.precio ?? 0;
    this.detalle = [...this.detalle, {
      seq:         this.nextSeq++,
      idProducto:  p.idProducto!,
      articulo:    p.articulo    ?? '',
      descripcion: p.descripcion ?? p.articulo ?? '',
      foto:        p.foto        ?? '',
      uMedida:     'Unidad',
      almacen:     'Principal',
      cantidad:    1,
      precio,
      descuento:   0,
      liquido:     precio,
      subtotal:    precio,
      _product:    p
    }];
  }

  recalcItem(item: DetalleItem): void {
    item.liquido  = item.precio * (1 - item.descuento / 100);
    item.subtotal = item.liquido * item.cantidad;
    this.detalle  = [...this.detalle];
  }

  removeItem(seq: number): void { this.detalle = this.detalle.filter(d => d.seq !== seq); }

  getTotal(): number { return this.detalle.reduce((a, d) => a + d.subtotal, 0); }

  // ─── GUARDAR ─────────────────────────────────────────────────
  guardar(): void {
    if (this.movForm.invalid) {
      Object.keys(this.movForm.controls).forEach(k => this.movForm.get(k)?.markAsTouched());
      Swal.fire({ icon: 'warning', title: 'Completa los campos requeridos' });
      return;
    }
    if (!this.detalle.length) {
      Swal.fire({ icon: 'warning', title: 'Sin productos', text: 'Agrega al menos un producto' });
      return;
    }

    // Validar stock para salidas
    if (this.tipoMovimiento === 'salida') {
      const sinStock = this.detalle.filter(i => i.cantidad > (i._product.unidad ?? 0));
      if (sinStock.length) {
        Swal.fire({
          icon: 'error', title: 'Stock insuficiente',
          html: sinStock.map(i =>
            `<b>${i.articulo}</b>: pedido <b>${i.cantidad}</b>, disponible <b>${i._product.unidad ?? 0}</b>`
          ).join('<br/>')
        });
        return;
      }
    }

    this.loading.set(true);
    const v = this.movForm.getRawValue();
    const glosa = [
      this.tipoMovimiento === 'entrada' ? `Compra #${v.codigo}` : `Venta #${v.codigo}`,
      v.contraparte,
      v.glosa
    ].filter(Boolean).join(' - ');

    // FIX 1: enviar en secuencia (no Promise.all) para evitar conflictos de stock
    // FIX 2: tipo en MAYÚSCULAS tal como espera el backend (ENTRADA / SALIDA)
    // FIX 3: NO llamar actualizarStock() — el backend ya lo hace en CreateMovements
    this.guardarSecuencial(v, glosa);
  }

  private async guardarSecuencial(v: any, glosa: string): Promise<void> {
    try {
      for (const item of this.detalle) {
        await this.movementsService.create({
          idProducto:    item.idProducto,
          cantidad:      item.cantidad,
          tipo:          this.tipoMovimiento.toUpperCase(), // FIX: ENTRADA / SALIDA en mayúsculas
          responsable:   v.contraparte,
          observaciones: glosa
        }).toPromise();
      }

      this.loading.set(false);

      Swal.fire({
        icon: 'success',
        title: this.tipoMovimiento === 'entrada' ? '¡Compra registrada!' : '¡Venta registrada!',
        html: `<b>${this.detalle.length}</b> producto(s) procesado(s) — Stock actualizado`,
        timer: 2200,
        showConfirmButton: false
      });

      // Recargar productos frescos del backend (stock actualizado por el servidor)
      this.resetForm(true);

    } catch (err: any) {
      this.loading.set(false);

      // Mostrar el mensaje de error del backend si existe
      const backendMsg = err?.error?.message || err?.message || '';
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: backendMsg || 'No se pudo registrar el movimiento. Verifica el stock disponible.'
      });
    }
  }

  cancelar(): void {
    if (!this.detalle.length) { this.resetForm(true); return; }
    Swal.fire({
      title: '¿Cancelar?', text: 'Se perderán los productos del detalle.',
      icon: 'question', showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, cancelar', cancelButtonText: 'No, volver'
    }).then(r => { if (r.isConfirmed) this.resetForm(true); });
  }

  private resetForm(reloadProducts: boolean): void {
    this.detalle = [];
    this.nextSeq = 1;
    this.productSearch = '';
    this.movForm.reset({
      codigo:     this.generateCodigo(),
      fecha:      this.today,
      formaPago:  this.tipoMovimiento === 'entrada' ? 'CRÉDITO' : 'CONTADO',
      tipoMoneda: 'BOLIVIANOS'
    });
    if (reloadProducts) this.loadProducts();
  }

  hasError(f: string, e: string): boolean {
    const c = this.movForm.get(f);
    return !!(c?.hasError(e) && c.touched);
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency', currency: 'BOB', minimumFractionDigits: 2
    }).format(val);
  }
}
