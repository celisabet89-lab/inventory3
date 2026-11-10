import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ProductService } from '../services/product.service';
import { CategoriaService } from '../services/Categoria.service';
import { UnidadMedidaService } from '../services/unidadMedida.servise';
import Swal from 'sweetalert2';

interface Categoria { idCategoria: number; nombre: string; color?: string; icono?: string; }
interface UnidadMedida { idUnidad: number; nombre: string; abreviatura: string; }
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

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit, OnChanges {
  @Input() product: Product | null = null;
  @Input() isEdit = false;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly productSvc = inject(ProductService);
  private readonly categoriaSvc = inject(CategoriaService);
  private readonly unidadSvc = inject(UnidadMedidaService);

  form!: FormGroup;
  readonly saving = signal(false);
  readonly loadingCatalogs = signal(false);
  readonly loadingProduct = signal(false);
  readonly fotoPreview = signal<string | null>(null);
  readonly categorias = signal<Categoria[]>([]);
  readonly unidades = signal<UnidadMedida[]>([]);
  private readonly maxImageSize = 2 * 1024 * 1024;

  ngOnInit(): void {
    this.buildForm();
    this.loadCatalogs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) return;
    if (changes['product'] || changes['isEdit']) {
      if (this.isEdit && this.product) this.loadProductData();
      else this.resetForm();
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      articulo: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      descripcion: ['', [Validators.maxLength(500)]],
      categoria: [null, Validators.required],
      unidadMedida: [null, Validators.required],
      precio: [0, [Validators.required, Validators.min(0)]],
      unidad: [0, [Validators.required, Validators.min(0)]],
      codigoBarras: ['', [Validators.pattern('^[0-9]*$'), Validators.maxLength(50)]],
      foto: ['']
    });
  }

  private loadCatalogs(): void {
    this.loadingCatalogs.set(true);
    forkJoin({ categorias: this.categoriaSvc.getAll(), unidades: this.unidadSvc.getAll() })
      .pipe(finalize(() => this.loadingCatalogs.set(false)))
      .subscribe({
        next: ({ categorias, unidades }) => {
          this.categorias.set(categorias ?? []);
          this.unidades.set(unidades ?? []);
          if (this.isEdit && this.product) this.loadProductData();
        },
        error: () => Swal.fire({
          icon: 'warning',
          title: 'No se pudieron cargar los catálogos',
          text: 'Verifica la conexión antes de guardar el producto.'
        })
      });
  }

  private loadProductData(): void {
    if (!this.product || !this.form) return;
    this.loadingProduct.set(true);
    const categoriaId = this.product.categoria?.idCategoria ?? null;
    const unidadId = this.product.unidadMedida?.idUnidad ?? null;

    this.form.reset({
      articulo: this.product.articulo ?? '',
      descripcion: this.product.descripcion ?? '',
      categoria: categoriaId,
      unidadMedida: unidadId,
      precio: Number(this.product.precio ?? 0),
      unidad: Number(this.product.unidad ?? 0),
      codigoBarras: this.product.codigoBarras ?? '',
      foto: this.product.foto ?? ''
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.fotoPreview.set(this.product.foto || null);
    this.loadingProduct.set(false);
  }

  resetForm(): void {
    if (!this.form) return;
    this.form.reset({
      articulo: '', descripcion: '', categoria: null, unidadMedida: null,
      precio: 0, unidad: 0, codigoBarras: '', foto: ''
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.fotoPreview.set(null);
  }

  onFotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      Swal.fire('Formato no permitido', 'Selecciona una imagen JPG, PNG o WEBP.', 'warning');
      input.value = '';
      return;
    }
    if (file.size > this.maxImageSize) {
      Swal.fire('Imagen muy grande', 'El tamaño máximo permitido es 2 MB.', 'warning');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result ?? '');
      this.fotoPreview.set(base64);
      this.form.patchValue({ foto: base64 });
      this.form.markAsDirty();
    };
    reader.onerror = () => Swal.fire('Error', 'No se pudo leer la imagen seleccionada.', 'error');
    reader.readAsDataURL(file);
  }

  quitarFoto(): void {
    this.fotoPreview.set(null);
    this.form.patchValue({ foto: '' });
    this.form.markAsDirty();
    const input = document.querySelector<HTMLInputElement>('.foto-file-input');
    if (input) input.value = '';
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.form.get(field);
    return Boolean(control?.hasError(errorType) && control?.touched);
  }

  getFieldError(field: string): string {
    const control = this.form.get(field);
    if (!control?.touched || !control.errors) return '';
    const errors = control.errors;
    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['minlength']) return `Escribe al menos ${errors['minlength'].requiredLength} caracteres.`;
    if (errors['maxlength']) return `El máximo permitido es ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['min']) return `El valor mínimo permitido es ${errors['min'].min}.`;
    if (errors['pattern']) return 'Utiliza solo números para el código de barras.';
    return 'Revisa este campo.';
  }

  getCategoriaSeleccionada(): Categoria | null {
    const rawId = this.form?.get('categoria')?.value;
    if (rawId === null || rawId === undefined || rawId === '') return null;
    return this.categorias().find(c => Number(c.idCategoria) === Number(rawId)) ?? null;
  }

  getCategoriaStyle(): Record<string, string> {
    const category = this.getCategoriaSeleccionada();
    if (!category?.color) return {};
    return {
      backgroundColor: `${category.color}18`,
      color: category.color,
      borderColor: `${category.color}80`
    };
  }

  guardar(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire('Formulario incompleto', 'Revisa los campos marcados antes de continuar.', 'warning');
      return;
    }

    const value = this.form.getRawValue();
    const body = {
      articulo: String(value.articulo).trim(),
      descripcion: String(value.descripcion ?? '').trim(),
      precio: Number(value.precio),
      unidad: Number(value.unidad),
      codigoBarras: String(value.codigoBarras ?? '').trim() || undefined,
      foto: value.foto || undefined,
      categoria: Number(value.categoria),
      unidadMedida: Number(value.unidadMedida)
    };

    const productId = this.product?.idProducto;
    const updating = this.isEdit && productId != null;
    const operation = updating
      ? this.productSvc.update(productId!, body)
      : this.productSvc.create(body);

    this.saving.set(true);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: updating ? 'Producto actualizado' : 'Producto creado',
          text: 'Los datos se guardaron correctamente.',
          timer: 1500,
          showConfirmButton: false
        });
        this.saved.emit();
      },
      error: (error) => Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar el producto',
        text: error?.error?.message || 'Verifica los datos e inténtalo nuevamente.'
      })
    });
  }

  cancelar(): void {
    if (this.saving()) return;
    if (!this.form.dirty) {
      this.cancelled.emit();
      return;
    }
    Swal.fire({
      title: '¿Descartar cambios?',
      text: 'Los cambios que no guardaste se perderán.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, descartar',
      cancelButtonText: 'Continuar editando',
      reverseButtons: true
    }).then(result => {
      if (result.isConfirmed) this.cancelled.emit();
    });
  }
}
