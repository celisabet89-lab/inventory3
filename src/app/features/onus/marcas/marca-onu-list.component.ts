import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { MarcaOnu, MarcaOnuService } from '../services/marca-onu.service';
import { mensajeError } from '../services/onu-operaciones.service';

@Component({
  selector: 'app-marca-onu-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './marca-onu-list.component.html',
  styleUrls: ['../../../shared/onu-pantalla.css']
})
export class MarcaOnuListComponent implements OnInit {
  private svc = inject(MarcaOnuService);

  marcas = signal<MarcaOnu[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  guardando = signal(false);

  formAbierto = signal(false);
  editandoId: number | null = null;
  form: MarcaOnu = { nombre: '', descripcion: '' };

  filtradas = computed(() => {
    const t = this.busqueda().toLowerCase().trim();
    return this.marcas()
      .filter(m => !t || `${m.nombre} ${m.descripcion ?? ''}`.toLowerCase().includes(t))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.marcas.set(d); this.cargando.set(false); },
      error: () => { this.cargando.set(false); Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las marcas' }); }
    });
  }

  nueva(): void {
    this.editandoId = null;
    this.form = { nombre: '', descripcion: '' };
    this.formAbierto.set(true);
  }

  editar(m: MarcaOnu): void {
    this.editandoId = m.id ?? null;
    this.form = { ...m };
    this.formAbierto.set(true);
  }

  cancelar(): void { this.formAbierto.set(false); }

  guardar(): void {
    if (!this.form.nombre?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Falta el nombre', text: 'Escribe el nombre de la marca.' });
      return;
    }
    const body = { ...this.form, nombre: this.form.nombre.trim() };
    this.guardando.set(true);
    const peticion = this.editandoId ? this.svc.update(this.editandoId, body) : this.svc.create(body);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.formAbierto.set(false);
        Swal.fire({ icon: 'success', title: 'Guardado', timer: 1400, showConfirmButton: false });
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: mensajeError(err) });
      }
    });
  }

  eliminar(m: MarcaOnu): void {
    Swal.fire({
      icon: 'warning', title: '¿Eliminar marca?', text: m.nombre,
      showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626'
    }).then(r => {
      if (!r.isConfirmed || !m.id) return;
      this.svc.delete(m.id).subscribe({
        next: () => this.cargar(),
        error: err => Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: mensajeError(err) })
      });
    });
  }
}
