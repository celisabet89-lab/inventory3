import { Component, OnInit, OnChanges, Input, Output, EventEmitter, inject, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClientService } from '../services/client.service';
import { LugarVentaService } from '../services/lugar-venta.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './client-form.component.html',
  styleUrls: ['../../../shared/onu-pantalla.css', './client-form.component.css']
})
export class ClientFormComponent implements OnInit, OnChanges {
  @Input() client: any = null;
  @Input() isEdit = false;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private fb        = inject(FormBuilder);
  private clientSvc = inject(ClientService);
  private lugarSvc  = inject(LugarVentaService);

  form!:   FormGroup;
  saving   = signal(false);
  lugares  = signal<any[]>([]);

  ngOnInit(): void {
    this.buildForm();
    this.lugarSvc.getAll().subscribe({
      next: d => this.lugares.set(d),
      error: e => console.error('Error cargando lugares:', e)
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) return;
    if (changes['client'] || changes['isEdit']) this.resetForm();
  }

  buildForm(): void {
    this.form = this.fb.group({
      nombre:        ['', [Validators.required, Validators.minLength(2)]],
      apellido:      ['', [Validators.required, Validators.minLength(2)]],
      ci:            [''],
      telefono:      [null, Validators.pattern(/^\d{6,15}$/)],           // Integer en backend
      gmail:         ['', Validators.email],             // gmail (no email)
      direccion:     [''],
      zona:          [''],
      estado:        ['ACTIVO'],
      observaciones: [''],
      // FIX: idLugarVenta — campo exacto del ClienteRequest
      idLugarVenta:  [null]
    });
    this.resetForm();
  }

  resetForm(): void {
    if (!this.form) return;
    this.form.reset({
      nombre:'', apellido:'', ci:'', telefono: null,
      gmail:'', direccion:'', zona:'',
      estado:'ACTIVO', observaciones:'', idLugarVenta: null
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();

    if (this.isEdit && this.client) {
      this.form.patchValue({
        nombre:        this.client.nombre        || '',
        apellido:      this.client.apellido      || '',
        ci:            this.client.ci            || '',
        telefono:      this.client.telefono      || null,
        gmail:         this.client.gmail         || '',
        direccion:     this.client.direccion     || '',
        zona:          this.client.zona          || '',
        estado:        this.client.estado        || 'ACTIVO',
        observaciones: this.client.observaciones || '',
        // Extraer ID del objeto anidado si el backend lo devuelve así
        idLugarVenta:  this.client.lugarVenta?.idLugarVenta
          ?? this.client.idLugarVenta
          ?? null
      });
    }
  }

  nombreCompleto(): string {
    return `${this.form?.value?.nombre ?? ''} ${this.form?.value?.apellido ?? ''}`.trim();
  }

  iniciales(): string {
    const n = String(this.form?.value?.nombre ?? '').trim().charAt(0);
    const a = String(this.form?.value?.apellido ?? '').trim().charAt(0);
    return (n + a).toUpperCase() || '?';
  }

  setEstado(valor: 'ACTIVO' | 'INACTIVO'): void {
    this.form.patchValue({ estado: valor });
    this.form.get('estado')?.markAsDirty();
  }

  hasError(f: string, t?: string): boolean {
    const c = this.form.get(f);
    return !!(c && c.touched && (t ? c.hasError(t) : c.invalid));
  }

  getError(f: string): string {
    const e = this.form.get(f)?.errors;
    if (!e) return '';
    if (e['required']) return 'Campo obligatorio';
    if (e['minlength']) return `Mínimo ${e['minlength'].requiredLength} caracteres`;
    if (e['email']) return 'Correo inválido';
    if (e['pattern']) return 'Solo dígitos (6 a 15)';
    return 'Valor inválido';
  }

  getLugarSeleccionado(): any {
    const id = this.form.value.idLugarVenta;
    return id ? this.lugares().find(l => l.idLugarVenta == id) ?? null : null;
  }

  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);

    const v = this.form.value;
    // FIX: body usa los campos exactos de ClienteRequest
    const body = {
      nombre:        v.nombre,
      apellido:      v.apellido,
      ci:            v.ci            || '',
      telefono:      v.telefono      ? Number(v.telefono) : null,
      gmail:         v.gmail         || '',
      direccion:     v.direccion     || '',
      zona:          v.zona          || '',
      estado:        v.estado,
      observaciones: v.observaciones || '',
      idLugarVenta:  v.idLugarVenta  ? Number(v.idLugarVenta) : null
    };

    const idEdit = this.client?.idCliente ?? this.client?.id;
    const op = this.isEdit && idEdit
      ? this.clientSvc.update(idEdit, body)
      : this.clientSvc.create(body);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        Swal.fire({ icon:'success', title: this.isEdit ? 'Cliente actualizado' : 'Cliente creado', timer:1400, showConfirmButton:false });
        this.saved.emit();
      },
      error: err => {
        this.saving.set(false);
        Swal.fire({ icon:'error', title:'Error al guardar', text: err?.error?.message || 'Error del servidor' });
      }
    });
  }

  cancelar(): void { this.cancelled.emit(); }
}
