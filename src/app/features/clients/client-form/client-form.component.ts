import { Component, OnInit, OnChanges, Input, Output, EventEmitter, inject, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClientService } from '../services/client.service';
import { LugarVentaService } from '../services/lugar-venta.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './client-form.component.html',
  styleUrls: ['./client-form.component.css']
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
      nombre:        ['', Validators.required],
      apellido:      ['', Validators.required],
      ci:            [''],
      telefono:      [null],           // Integer en backend
      gmail:         [''],             // gmail (no email)
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

  hasError(f: string, t: string): boolean {
    const c = this.form.get(f);
    return !!(c?.hasError(t) && c?.touched);
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

    console.log('Guardando cliente:', body);

    const op = this.isEdit && this.client?.idCliente
      ? this.clientSvc.update(this.client.idCliente, body)
      : this.clientSvc.create(body);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        Swal.fire({ icon:'success', title: this.isEdit ? 'Cliente actualizado' : 'Cliente creado', timer:1400, showConfirmButton:false });
        this.saved.emit();
      },
      error: err => {
        this.saving.set(false);
        console.error('Error:', err);
        Swal.fire({ icon:'error', title:'Error al guardar', text: err?.error?.message || 'Error del servidor' });
      }
    });
  }

  cancelar(): void { this.cancelled.emit(); }
}
