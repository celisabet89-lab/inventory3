import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolService } from '../services/Rol.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-rol-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rol-list.component.html',
  styleUrls: ['./rol-list.component.css']
})
export class RolListComponent implements OnInit {
  private rolService = inject(RolService);

  roles    = signal<any[]>([]);
  loading  = signal(false);
  saving   = signal(false);

  // Form inline
  showForm  = false;
  isEdit    = false;
  editId: number | null = null;
  cargo     = '';
  errorMsg  = '';

  ngOnInit(): void { this.loadRoles(); }

  loadRoles(): void {
    this.loading.set(true);
    this.rolService.getAll().subscribe({
      next: r => { this.roles.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.editId = null;
    this.cargo  = '';
    this.errorMsg = '';
    this.showForm = true;
  }

  openEdit(rol: any): void {
    this.isEdit   = true;
    this.editId   = rol.id;
    this.cargo    = rol.cargo;
    this.errorMsg = '';
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.cargo    = '';
    this.errorMsg = '';
  }

  guardar(): void {
    const nombre = this.cargo.trim();
    if (!nombre) { this.errorMsg = 'El nombre del rol es requerido'; return; }

    // Verificar duplicado
    const existe = this.roles().some(r =>
      r.cargo.toLowerCase() === nombre.toLowerCase() && r.id !== this.editId
    );
    if (existe) { this.errorMsg = `Ya existe un rol llamado "${nombre}"`; return; }

    this.saving.set(true);
    const op = this.isEdit && this.editId
      ? this.rolService.update(this.editId, { cargo: nombre })
      : this.rolService.create({ cargo: nombre });

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelForm();
        this.loadRoles();
        Swal.fire({
          icon: 'success',
          title: this.isEdit ? 'Rol actualizado' : 'Rol creado',
          timer: 1400, showConfirmButton: false
        });
      },
      error: () => {
        this.saving.set(false);
        this.errorMsg = 'Error al guardar. Intenta de nuevo.';
      }
    });
  }

  eliminar(rol: any): void {
    Swal.fire({
      title: '¿Eliminar rol?',
      html: `¿Seguro que deseas eliminar el rol <b>${rol.cargo}</b>?<br>
             <small style="color:#ef4444">Los usuarios con este rol quedarán sin rol asignado.</small>`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed)
        this.rolService.delete(rol.id).subscribe({
          next: () => { this.loadRoles(); Swal.fire({ icon: 'success', title: 'Rol eliminado', timer: 1400, showConfirmButton: false }); },
          error: () => Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: 'El rol puede estar en uso' })
        });
    });
  }

  getRolColor(cargo: string): string {
    const c = cargo.toLowerCase();
    if (c.includes('admin'))      return '#8b5cf6';
    if (c.includes('écnico') || c.includes('ecnico')) return '#f59e0b';
    if (c.includes('encargado'))  return '#10b981';
    return '#3b82f6';
  }
}
