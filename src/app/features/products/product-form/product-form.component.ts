import { Component, OnInit, OnChanges, Input, Output, EventEmitter, inject, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ProductService } from '../services/product.service';
import { CategoriaService } from '../services/Categoria.service';
import { UnidadMedidaService } from '../services/unidadMedida.servise';
import Swal from 'sweetalert2';

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

  private fb = inject(FormBuilder);
  private productSvc = inject(ProductService);
  private categoriaSvc = inject(CategoriaService);
  private unidadSvc = inject(UnidadMedidaService);

  form!: FormGroup;
  saving = signal(false);
  loadingCatalogs = signal(false);
  loadingProduct = signal(false);
  fotoPreview = signal<string | null>(null);
  categorias = signal<Categoria[]>([]);
  unidades = signal<UnidadMedida[]>([]);

  private readonly MAX_IMAGE_SIZE = 2 * 1024 * 1024;

  ngOnInit(): void {
    this.buildForm();
    this.loadCatalogs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // IMPORTANTE: Detectar cambios en product y isEdit
    if (changes['product'] || changes['isEdit']) {
      if (this.form) {
        if (this.isEdit && this.product) {
          this.loadProductData();
        } else if (!this.isEdit) {
          this.resetForm();
        }
      }
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      articulo: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      descripcion: ['', [Validators.maxLength(500)]],
      categoria: [null, [Validators.required]],
      unidadMedida: [null, [Validators.required]],
      precio: [0, [Validators.required, Validators.min(0)]],
      unidad: [0, [Validators.min(0)]],
      codigoBarras: ['', [Validators.pattern('^[0-9]*$'), Validators.maxLength(50)]],
      foto: ['']
    });
  }

  private loadProductData(): void {
    if (!this.product) return;

    console.log('Cargando datos del producto:', this.product);
    this.loadingProduct.set(true);

    // Extraer IDs correctamente con validación de null
    const categoriaId = this.product.categoria?.idCategoria ?? null;
    const unidadId = this.product.unidadMedida?.idUnidad ?? null;

    const patchData = {
      articulo: this.product.articulo || '',
      descripcion: this.product.descripcion || '',
      categoria: categoriaId,
      unidadMedida: unidadId,
      precio: this.product.precio || 0,
      unidad: this.product.unidad || 0,
      codigoBarras: this.product.codigoBarras || '',
      foto: this.product.foto || ''
    };

    console.log('Datos a cargar en el formulario:', patchData);

    // Resetear y luego patch
    this.form.reset(patchData);
    this.form.markAsPristine();
    this.form.markAsUntouched();

    if (this.product.foto) {
      this.fotoPreview.set(this.product.foto);
    } else {
      this.fotoPreview.set(null);
    }

    this.loadingProduct.set(false);
  }

  resetForm(): void {
    if (!this.form) return;

    this.form.reset({
      articulo: '',
      descripcion: '',
      categoria: null,
      unidadMedida: null,
      precio: 0,
      unidad: 0,
      codigoBarras: '',
      foto: ''
    });

    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.fotoPreview.set(null);
  }

  private loadCatalogs(): void {
    this.loadingCatalogs.set(true);

    // Cargar catálogos en paralelo
    Promise.all([
      this.categoriaSvc.getAll().toPromise(),
      this.unidadSvc.getAll().toPromise()
    ]).then(([categorias, unidades]) => {
      if (categorias) {
        this.categorias.set(categorias as Categoria[]);
        console.log('Categorías cargadas:', categorias);
      }
      if (unidades) {
        this.unidades.set(unidades as UnidadMedida[]);
        console.log('Unidades cargadas:', unidades);
      }

      // Después de cargar catálogos, si estamos en modo edición, cargar datos
      if (this.isEdit && this.product) {
        this.loadProductData();
      }
    }).catch(error => {
      console.error('Error cargando catálogos:', error);
      Swal.fire({
        icon: 'warning',
        title: 'Error al cargar datos',
        text: 'No se pudieron cargar las categorías o unidades de medida'
      });
    }).finally(() => {
      this.loadingCatalogs.set(false);
    });
  }

  onFotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > this.MAX_IMAGE_SIZE) {
      Swal.fire({
        icon: 'warning',
        title: 'Imagen muy grande',
        text: `El tamaño máximo es de ${this.MAX_IMAGE_SIZE / (1024 * 1024)}MB`
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.fotoPreview.set(base64);
      this.form.patchValue({ foto: base64 });
      this.form.markAsDirty();
    };
    reader.readAsDataURL(file);
  }

  quitarFoto(): void {
    this.fotoPreview.set(null);
    this.form.patchValue({ foto: '' });
    this.form.markAsDirty();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(errorType) && control?.touched);
  }

  getFieldError(field: string): string {
    const control = this.form.get(field);
    if (!control?.touched || !control?.errors) return '';

    const errors = control.errors;
    if (errors['required']) return 'Este campo es requerido';
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['min']) return `El valor mínimo es ${errors['min'].min}`;
    if (errors['pattern']) return 'Formato inválido';

    return 'Campo inválido';
  }

  getCategoriaSeleccionada(): Categoria | null {
    const id = this.form.value.categoria;
    if (!id) return null;
    const categoria = this.categorias().find(c => c.idCategoria === id);
    console.log('Categoría seleccionada:', categoria);
    return categoria || null;
  }

  getCategoriaStyle(): { [key: string]: string } {
    const categoria = this.getCategoriaSeleccionada();
    if (!categoria?.color) {
      return {};
    }

    return {
      backgroundColor: `${categoria.color}22`,
      color: categoria.color,
      borderColor: categoria.color
    };
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor, completa todos los campos requeridos correctamente'
      });
      return;
    }

    this.saving.set(true);
    const formValue = this.form.value;

    const body = {
      articulo: formValue.articulo.trim(),
      descripcion: formValue.descripcion?.trim() || '',
      precio: Number(formValue.precio),
      unidad: Number(formValue.unidad) || 0,
      codigoBarras: formValue.codigoBarras?.trim() || null,
      foto: formValue.foto || null,
      categoria: formValue.categoria ? Number(formValue.categoria) : null,
      unidadMedida: formValue.unidadMedida ? Number(formValue.unidadMedida) : null
    };

    console.log('Guardando producto:', body);

    // @ts-ignore
    const operation = !(this.isEdit && this.product?.idProducto) ? this.productSvc.create(body) : this.productSvc.update(this.product.idProducto, body);

    operation.pipe(
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        Swal.fire({
          icon: 'success',
          title: this.isEdit ? 'Producto actualizado' : 'Producto creado',
          timer: 1500,
          showConfirmButton: false
        });
        this.saved.emit();
      },
      error: (error) => {
        console.error('Error al guardar:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error al guardar',
          text: error?.error?.message || 'Ocurrió un error al guardar el producto'
        });
      }
    });
  }

  cancelar(): void {
    if (this.form.dirty) {
      Swal.fire({
        title: '¿Descartar cambios?',
        text: 'Tienes cambios sin guardar que se perderán',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, descartar',
        cancelButtonText: 'No, continuar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.cancelled.emit();
        }
      });
    } else {
      this.cancelled.emit();
    }
  }
}
