import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnidadMedidaService } from '../../services/unidadMedida.servise';
import Swal from 'sweetalert2';

interface UnidadMedida {
  idUnidad?: number;  // Cambiar de 'id' a 'idUnidad'
  id?: number;        // Mantener por compatibilidad
  nombre: string;
  abreviatura: string;
}

@Component({
  selector: 'app-unidad-medida-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './unidad-medida-list.component.html',
  styleUrls: ['./unidad-medida-list.component.css']
})
export class UnidadMedidaListComponent implements OnInit {
  private svc = inject(UnidadMedidaService);

  unidades = signal<UnidadMedida[]>([]);
  loading  = signal(false);
  saving   = signal(false);
  showForm = false;
  isEdit   = false;
  editId: number | null = null;
  nombre      = '';
  abreviatura = '';
  errorMsg    = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (data: UnidadMedida[]) => {
        console.log('Unidades cargadas:', data);
        this.unidades.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error cargando unidades:', error);
        this.loading.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar',
          text: 'No se pudieron cargar las unidades de medida'
        });
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.editId = null;
    this.nombre = '';
    this.abreviatura = '';
    this.errorMsg = '';
    this.showForm = true;
  }

  openEdit(unidad: UnidadMedida): void {
    console.log('Editando unidad:', unidad);

    // Obtener el ID correctamente (puede ser id o idUnidad)
    const id = unidad.idUnidad || unidad.id;

    if (!id) {
      console.error('Unidad sin ID:', unidad);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'La unidad de medida no tiene un ID válido'
      });
      return;
    }

    this.isEdit = true;
    this.editId = id;
    this.nombre = unidad.nombre;
    this.abreviatura = unidad.abreviatura ?? '';
    this.errorMsg = '';
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.errorMsg = '';
    this.nombre = '';
    this.abreviatura = '';
    this.editId = null;
  }

  guardar(): void {
    if (!this.nombre.trim()) {
      this.errorMsg = 'El nombre es requerido';
      return;
    }

    if (!this.abreviatura.trim()) {
      this.errorMsg = 'La abreviatura es requerida';
      return;
    }

    // Verificar duplicados
    const dup = this.unidades().some(u => {
      const uId = u.idUnidad || u.id;
      return u.nombre.toLowerCase() === this.nombre.trim().toLowerCase() && uId !== this.editId;
    });

    if (dup) {
      this.errorMsg = `Ya existe la unidad "${this.nombre}"`;
      return;
    }

    this.saving.set(true);
    const body = {
      nombre: this.nombre.trim(),
      abreviatura: this.abreviatura.trim().toUpperCase() // Convertir a mayúsculas
    };

    const operation = this.isEdit && this.editId
      ? this.svc.update(this.editId, body)
      : this.svc.create(body);

    operation.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancel();
        this.load();
        Swal.fire({
          icon: 'success',
          title: this.isEdit ? 'Unidad actualizada' : 'Unidad creada',
          timer: 1400,
          showConfirmButton: false
        });
      },
      error: (error) => {
        this.saving.set(false);
        console.error('Error al guardar unidad:', error);

        if (error.status === 401) {
          this.errorMsg = 'No autorizado. Por favor, inicia sesión nuevamente.';
        } else if (error.status === 409) {
          this.errorMsg = 'Ya existe una unidad con este nombre o abreviatura.';
        } else {
          this.errorMsg = error?.error?.message || 'Error al guardar. Verifica la conexión con el backend.';
        }
      }
    });
  }

  eliminar(unidad: UnidadMedida): void {
    // Obtener el ID correctamente
    const id = unidad.idUnidad || unidad.id;

    if (!id) {
      console.error('Unidad sin ID para eliminar:', unidad);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se puede eliminar: ID de unidad inválido'
      });
      return;
    }

    Swal.fire({
      title: `¿Eliminar "${unidad.nombre}"?`,
      html: `<small style="color:#ef4444">⚠️ Los productos con esta unidad quedarán sin unidad asignada.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (result.isConfirmed) {
        this.loading.set(true);
        this.svc.delete(id).subscribe({
          next: () => {
            this.load();
            Swal.fire({
              icon: 'success',
              title: 'Eliminada',
              text: `La unidad "${unidad.nombre}" ha sido eliminada`,
              timer: 1500,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error al eliminar:', error);
            this.loading.set(false);
            let errorMessage = 'No se pudo eliminar la unidad';

            if (error.status === 401) {
              errorMessage = 'No autorizado. Por favor, inicia sesión nuevamente.';
            } else if (error.status === 409) {
              errorMessage = 'No se puede eliminar porque hay productos asociados a esta unidad.';
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            }

            Swal.fire({
              icon: 'error',
              title: 'Error al eliminar',
              text: errorMessage
            });
          }
        });
      }
    });
  }
  getUnidadId(unidad: UnidadMedida): number | undefined {
    return unidad.idUnidad || unidad.id;
  }
}
