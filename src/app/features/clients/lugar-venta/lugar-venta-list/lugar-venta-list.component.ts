
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

  lugares = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);

  searchTerm = '';
  filtroEstado = 'TODOS';

  showForm = false;
  isEdit = false;
  editId: number | null = null;

  nombre = '';
  direccion = '';
  zona = '';
  ciudad = '';
  telefono = '';
  referencia = '';
  estado = 'ACTIVO';
  errorMsg = '';

  get lugaresFiltrados(): any[] {
    const termino = this.searchTerm.trim().toLocaleLowerCase();

    return this.lugares().filter(lugar => {
      const coincideEstado = this.filtroEstado === 'TODOS' ||
        (lugar.estado ?? 'ACTIVO') === this.filtroEstado;

      const valores = [
        lugar.nombre,
        lugar.direccion,
        lugar.zona,
        lugar.ciudad,
        lugar.telefono,
        lugar.referencia
      ];

      const coincideBusqueda = !termino ||
        valores.some(valor =>
          String(valor ?? '').toLocaleLowerCase().includes(termino)
        );

      return coincideEstado && coincideBusqueda;
    });
  }

  get totalActivos(): number {
    return this.lugares().filter(l => (l.estado ?? 'ACTIVO') === 'ACTIVO').length;
  }

  get totalInactivos(): number {
    return this.lugares().filter(l => l.estado === 'INACTIVO').length;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.svc.getAll().subscribe({
      next: data => {
        this.lugares.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({
          icon: 'error',
          title: 'No se pudieron cargar los lugares',
          text: 'Comprueba la conexión con el servidor e inténtalo nuevamente.'
        });
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.editId = null;
    this.nombre = '';
    this.direccion = '';
    this.zona = '';
    this.ciudad = '';
    this.telefono = '';
    this.referencia = '';
    this.estado = 'ACTIVO';
    this.errorMsg = '';
    this.showForm = true;
  }

  openEdit(lugar: any): void {
    this.isEdit = true;
    this.editId = lugar.idLugarVenta;
    this.nombre = lugar.nombre ?? '';
    this.direccion = lugar.direccion ?? '';
    this.zona = lugar.zona ?? '';
    this.ciudad = lugar.ciudad ?? '';
    this.telefono = lugar.telefono ?? '';
    this.referencia = lugar.referencia ?? '';
    this.estado = lugar.estado ?? 'ACTIVO';
    this.errorMsg = '';
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.errorMsg = '';
    this.nombre = '';
    this.direccion = '';
    this.zona = '';
    this.ciudad = '';
    this.telefono = '';
    this.referencia = '';
    this.estado = 'ACTIVO';
  }

  guardar(): void {
    const nombreLimpio = this.nombre.trim();

    if (!nombreLimpio) {
      this.errorMsg = 'El nombre del lugar es obligatorio.';
      return;
    }

    const duplicado = this.lugares().some(lugar =>
      String(lugar.nombre ?? '').trim().toLocaleLowerCase() ===
      nombreLimpio.toLocaleLowerCase() &&
      lugar.idLugarVenta !== this.editId
    );

    if (duplicado) {
      this.errorMsg = `Ya existe un lugar llamado "${nombreLimpio}".`;
      return;
    }

    this.saving.set(true);
    this.errorMsg = '';

    const body = {
      nombre: nombreLimpio,
      direccion: this.direccion.trim(),
      zona: this.zona.trim(),
      ciudad: this.ciudad.trim(),
      telefono: this.telefono.trim(),
      referencia: this.referencia.trim(),
      estado: this.estado
    };

    const operacion = this.isEdit && this.editId !== null
      ? this.svc.update(this.editId, body)
      : this.svc.create(body);

    operacion.subscribe({
      next: () => {
        const titulo = this.isEdit ? 'Lugar actualizado' : 'Lugar creado';

        this.saving.set(false);
        this.cancel();
        this.load();

        Swal.fire({
          icon: 'success',
          title: titulo,
          timer: 1400,
          showConfirmButton: false
        });
      },
      error: err => {
        this.saving.set(false);
        this.errorMsg = err?.error?.message ??
          'No se pudo guardar el lugar. Comprueba los datos e inténtalo nuevamente.';
      }
    });
  }

  eliminar(lugar: any): void {
    const id = lugar?.idLugarVenta;

    if (id === null || id === undefined) {
      Swal.fire({
        icon: 'error',
        title: 'No se puede eliminar',
        text: 'El lugar no tiene un identificador válido.'
      });
      return;
    }

    Swal.fire({
      title: `¿Eliminar "${lugar.nombre}"?`,
      text: 'Si tiene clientes relacionados, el servidor podría impedir la eliminación.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(resultado => {
      if (!resultado.isConfirmed) {
        return;
      }

      this.svc.delete(Number(id)).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Lugar eliminado',
            timer: 1200,
            showConfirmButton: false
          });
          this.load();
        },
        error: err => {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo eliminar',
            text: err?.error?.message ??
              'Puede que existan clientes asociados a este lugar.'
          });
        }
      });
    });
  }
}
