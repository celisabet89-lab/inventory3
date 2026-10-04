import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LugarVentaService } from '../../services/lugar-venta.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lugar-venta-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lugar-venta-list.component.html',
  styleUrls: ['./lugar-venta-list.component.css']
})
export class LugarVentaListComponent implements OnInit {
  private svc = inject(LugarVentaService);

  lugares  = signal<any[]>([]);
  loading  = signal(false);
  saving   = signal(false);
  showForm = false;
  isEdit   = false;
  editId: number | null = null;

  // Campos del form
  nombre     = '';
  direccion  = '';
  zona       = '';
  ciudad     = '';
  telefono   = '';
  referencia = '';
  errorMsg   = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.lugares.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openNew(): void {
    this.isEdit    = false;
    this.editId    = null;
    this.nombre    = '';
    this.direccion = '';
    this.zona      = '';
    this.ciudad    = '';
    this.telefono  = '';
    this.referencia = '';
    this.errorMsg  = '';
    this.showForm  = true;
  }

  openEdit(l: any): void {
    this.isEdit    = true;
    this.editId    = l.idLugarVenta;
    this.nombre    = l.nombre     ?? '';
    this.direccion = l.direccion  ?? '';
    this.zona      = l.zona       ?? '';
    this.ciudad    = l.ciudad     ?? '';
    this.telefono  = l.telefono   ?? '';
    this.referencia = l.referencia ?? '';
    this.errorMsg  = '';
    this.showForm  = true;
  }

  cancel(): void {
    this.showForm  = false;
    this.errorMsg  = '';
    this.nombre    = '';
    this.direccion = '';
  }

  guardar(): void {
    if (!this.nombre.trim()) { this.errorMsg = 'El nombre es requerido'; return; }

    const dup = this.lugares().some(l =>
      l.nombre.toLowerCase() === this.nombre.trim().toLowerCase() && l.idLugarVenta !== this.editId
    );
    if (dup) { this.errorMsg = `Ya existe "${this.nombre}"`; return; }

    this.saving.set(true);
    const body = {
      nombre:     this.nombre.trim(),
      direccion:  this.direccion.trim(),
      zona:       this.zona.trim(),
      ciudad:     this.ciudad.trim(),
      telefono:   this.telefono.trim(),
      referencia: this.referencia.trim(),
      estado:     'ACTIVO'
    };

    const op = this.isEdit && this.editId
      ? this.svc.update(this.editId, body)
      : this.svc.create(body);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancel();
        this.load();
        Swal.fire({
          icon: 'success',
          title: this.isEdit ? 'Lugar actualizado' : 'Lugar creado',
          timer: 1400, showConfirmButton: false
        });
      },
      error: () => { this.saving.set(false); this.errorMsg = 'Error al guardar'; }
    });
  }

  eliminar(l: any): void {
    Swal.fire({
      title: `¿Eliminar "${l.nombre}"?`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed)
        this.svc.delete(l.idLugarVenta).subscribe({
          next: () => { this.load(); Swal.fire({ icon:'success', title:'Eliminado', timer:1200, showConfirmButton:false }); },
          error: () => Swal.fire({ icon:'error', title:'Error al eliminar' })
        });
    });
  }
}
