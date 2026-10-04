import { Component, OnInit, inject, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProveedorService } from '../service/proveedor.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-proveedor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './proveedor-form.component.html',
  styleUrls: ['./proveedor-form.component.css']
})
export class ProveedorFormComponent implements OnInit {
  @Input() proveedorId: number | null = null;
  @Input() isEdit: boolean = false;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private proveedorService = inject(ProveedorService);

  proveedorForm!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);

  // Lista de países
  paises = [
    'Bolivia',
    'Argentina',
    'Brasil',
    'Chile',
    'Colombia',
    'Ecuador',
    'Paraguay',
    'Perú',
    'Uruguay',
    'Venezuela',
    'México',
    'España',
    'Estados Unidos',
    'China',
    'Japón',
    'Alemania',
    'Francia',
    'Italia',
    'Reino Unido',
    'Otro'
  ];

  estados = ['ACTIVO', 'INACTIVO'];

  ngOnInit(): void {
    this.initForm();
    if (this.proveedorId) {
      this.isEditMode.set(true);
      this.loadProveedor(this.proveedorId);
    }
  }

  initForm(): void {
    this.proveedorForm = this.fb.group({
      empresa: ['', [Validators.required, Validators.minLength(3)]],
      pais: ['Bolivia', Validators.required],
      contacto: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      direccion: ['', [Validators.required, Validators.minLength(5)]],
      estado: ['ACTIVO', Validators.required],
      observaciones: ['']
    });
  }

  loadProveedor(id: number): void {
    this.loading.set(true);
    console.log('🔄 Cargando proveedor ID:', id);

    this.proveedorService.getById(id).subscribe({
      next: (p: any) => {
        console.log('✅ Proveedor cargado:', p);
        this.proveedorForm.patchValue({
          empresa: p.empresa,
          pais: p.pais || 'Bolivia',
          contacto: p.contacto,
          email: p.email,
          direccion: p.direccion,
          estado: p.estado ?? 'ACTIVO',
          observaciones: p.observaciones ?? ''
        });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('❌ Error cargando proveedor:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar el proveedor'
        });
        this.loading.set(false);
        this.cancelled.emit();
      }
    });
  }

  onSubmit(): void {
    if (this.proveedorForm.invalid) {
      Object.keys(this.proveedorForm.controls).forEach(k =>
        this.proveedorForm.get(k)?.markAsTouched()
      );

      // Mostrar mensaje de error específico
      const errors = [];
      if (this.proveedorForm.get('empresa')?.errors) errors.push('Empresa');
      if (this.proveedorForm.get('contacto')?.errors) errors.push('Contacto');
      if (this.proveedorForm.get('email')?.errors) errors.push('Email');
      if (this.proveedorForm.get('direccion')?.errors) errors.push('Dirección');

      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: `Completa los campos requeridos: ${errors.join(', ')}`
      });
      return;
    }

    this.loading.set(true);
    const v = this.proveedorForm.value;

    const data: any = {
      empresa: v.empresa.trim(),
      pais: v.pais,
      contacto: v.contacto.trim(),
      email: v.email.trim().toLowerCase(),
      direccion: v.direccion.trim(),
      estado: v.estado,
      observaciones: v.observaciones || null
    };

    console.log('📦 Guardando proveedor:', data);

    const operation = (this.isEditMode() && this.proveedorId)
      ? this.proveedorService.update(this.proveedorId, data)
      : this.proveedorService.create(data);

    operation.subscribe({
      next: (response) => {
        console.log('✅ Proveedor guardado:', response);
        Swal.fire({
          icon: 'success',
          title: this.isEditMode() ? 'Proveedor actualizado' : 'Proveedor creado',
          html: `<b>${v.empresa}</b> registrado correctamente`,
          timer: 2000,
          showConfirmButton: false
        });
        this.saved.emit();
      },
      error: (err) => {
        console.error('❌ Error guardando proveedor:', err);
        let errorMsg = 'No se pudo guardar el proveedor';
        if (err.error?.message) {
          errorMsg = err.error.message;
        } else if (err.message) {
          errorMsg = err.message;
        }
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMsg
        });
        this.loading.set(false);
      }
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  hasError(f: string, e: string): boolean {
    const c = this.proveedorForm.get(f);
    return !!(c && c.hasError(e) && c.touched);
  }

  getError(f: string): string {
    const c = this.proveedorForm.get(f);
    if (!c?.errors) return '';

    if (c.errors['required']) return 'Campo obligatorio';
    if (c.errors['minlength']) return `Mínimo ${c.errors['minlength'].requiredLength} caracteres`;
    if (c.errors['email']) return 'Email inválido';
    if (c.errors['pattern']) {
      return 'Formato inválido';
    }
    return 'Inválido';
  }
}
