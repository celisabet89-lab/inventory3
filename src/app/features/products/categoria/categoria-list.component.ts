import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoriaService } from '../services/Categoria.service';
import Swal from 'sweetalert2';

interface Categoria {
  idCategoria?: number;
  id?: number;
  nombre: string;
  descripcion?: string;
  icono?: string;

}

@Component({
  selector: 'app-categoria-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categoria-list.component.html',
  styleUrls: ['./categoria-list.component.css']
})
export class CategoriaListComponent implements OnInit {
  private svc = inject(CategoriaService);

  categorias = signal<Categoria[]>([]);
  loading    = signal(false);
  saving     = signal(false);
  showForm   = false;
  isEdit     = false;
  editId: number | null = null;
  nombre      = '';
  descripcion = '';
  icono       = 'fa-box';
  color       = '#1b6f6f';
  errorMsg    = '';

  iconos  = ['fa-box','fa-wifi','fa-plug','fa-tools','fa-network-wired',
    'fa-bolt','fa-link','fa-folder','fa-microchip','fa-broadcast-tower',
    'fa-hard-hat','fa-wrench','fa-server','fa-hdd','fa-sitemap'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (data: Categoria[]) => {
        console.log('Categorías cargadas:', data);
        this.categorias.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error cargando categorías:', error);
        this.loading.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar',
          text: 'No se pudieron cargar las categorías'
        });
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.editId = null;
    this.nombre = '';
    this.descripcion = '';
    this.icono = 'fa-box';
    this.color = '#1b6f6f';
    this.errorMsg = '';
    this.showForm = true;
  }

  openEdit(categoria: Categoria): void {
    console.log('Editando categoría:', categoria);
    // Obtener el ID correctamente (puede ser id o idCategoria)
    const id = categoria.idCategoria || categoria.id;
    if (!id) {
      console.error('Categoría sin ID:', categoria);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'La categoría no tiene un ID válido'
      });
      return;
    }

    this.isEdit = true;
    this.editId = id;
    this.nombre = categoria.nombre;
    this.descripcion = categoria.descripcion ?? '';
    this.icono  = categoria.icono  ?? 'fa-box';
    this.errorMsg = '';
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.errorMsg = '';
    this.nombre = '';
  }

  guardar(): void {
    if (!this.nombre.trim()) {
      this.errorMsg = 'El nombre es requerido';
      return;
    }

    // Verificar duplicados
    const dup = this.categorias().some(c => {
      const cId = c.idCategoria || c.id;
      return c.nombre.toLowerCase() === this.nombre.trim().toLowerCase() && cId !== this.editId;
    });

    if (dup) {
      this.errorMsg = `Ya existe la categoría "${this.nombre}"`;
      return;
    }

    this.saving.set(true);
    const body = {
      nombre: this.nombre.trim(),
      descripcion: this.descripcion,
      icono: this.icono,
      color: this.color
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
          title: this.isEdit ? 'Categoría Actualizada' : 'Categoría Creada',
          timer: 1400,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error al guardar:', error);
        this.saving.set(false);
        if (error.status === 401) {
          this.errorMsg = 'No autorizado. Por favor, inicia sesión nuevamente.';
        } else {
          this.errorMsg = error?.error?.message || 'Error al guardar la categoría';
        }
      }
    });
  }

  eliminar(categoria: Categoria): void {
    // Obtener el ID correctamente
    const id = categoria.idCategoria || categoria.id;

    if (!id) {
      console.error('Categoría sin ID para eliminar:', categoria);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se puede eliminar: ID de categoría inválido'
      });
      return;
    }

    Swal.fire({
      title: `¿Eliminar "${categoria.nombre}"?`,
      text: 'Esta acción no se puede deshacer',
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
              text: `La categoría "${categoria.nombre}" ha sido eliminada`,
              timer: 1500,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error al eliminar:', error);
            this.loading.set(false);
            let errorMessage = 'Error al eliminar la categoría';
            if (error.status === 401) {
              errorMessage = 'No autorizado. Por favor, inicia sesión nuevamente.';
            } else if (error.status === 409) {
              errorMessage = 'No se puede eliminar porque hay productos asociados a esta categoría.';
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

  // Método auxiliar para obtener el ID de una categoría
  getCategoriaId(categoria: Categoria): number | undefined {
    return categoria.idCategoria || categoria.id;
  }
}
