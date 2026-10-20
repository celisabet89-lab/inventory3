import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { TipoClienteOnu, TipoClienteOnuService } from '../services/cliente-onu.service';
import { mensajeError } from '../services/onu-operaciones.service';

@Component({
  selector: 'app-tipo-cliente-onu-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './tipo-cliente-onu-list.component.html',
  styleUrls: ['../onu-recojo/onu-recojo.component.css', './tipo-cliente-onu-list.component.css']
})
export class TipoClienteOnuListComponent implements OnInit {
  private svc = inject(TipoClienteOnuService);

  readonly opcionesPagina = [10, 25, 50, 100];

  tipos = signal<TipoClienteOnu[]>([]);
  busqueda = signal('');
  porPagina = signal(10);
  pagina = signal(1);
  cargando = signal(false);
  guardando = signal(false);

  formAbierto = signal(false);
  editandoId: number | null = null;
  form: TipoClienteOnu = { nombre: '', descripcion: '', color: '#1b6f6f' };

  filtrados = computed(() => {
    const t = this.busqueda().toLowerCase().trim();
    return this.tipos().filter(x => !t || [x.id, x.nombre, x.descripcion].some(v => String(v ?? '').toLowerCase().includes(t)));
  });
  totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.porPagina())));
  visibles = computed(() => {
    const i = (this.pagina() - 1) * this.porPagina();
    return this.filtrados().slice(i, i + this.porPagina());
  });

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.tipos.set(d); this.cargando.set(false); },
      error: () => { this.cargando.set(false); Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los tipos' }); }
    });
  }

  buscar(t: string): void { this.busqueda.set(t); this.pagina.set(1); }
  cambiarPorPagina(v: number): void { this.porPagina.set(Number(v)); this.pagina.set(1); }
  irA(p: number): void { if (p >= 1 && p <= this.totalPaginas()) this.pagina.set(p); }
  desde(): number { return this.filtrados().length ? (this.pagina() - 1) * this.porPagina() + 1 : 0; }
  hasta(): number { return Math.min(this.pagina() * this.porPagina(), this.filtrados().length); }

  nuevo(): void {
    this.editandoId = null;
    this.form = { nombre: '', descripcion: '', color: '#1b6f6f' };
    this.formAbierto.set(true);
  }

  editar(t: TipoClienteOnu): void {
    this.editandoId = t.id ?? null;
    this.form = { ...t, color: t.color || '#1b6f6f' };
    this.formAbierto.set(true);
  }

  cerrar(): void { this.formAbierto.set(false); }

  guardar(): void {
    if (!this.form.nombre?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Falta el nombre', text: 'Escribe el nombre del tipo de cliente.' });
      return;
    }
    const body = { ...this.form, nombre: this.form.nombre.trim() };
    this.guardando.set(true);
    const peticion = this.editandoId ? this.svc.update(this.editandoId, body) : this.svc.create(body);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrar();
        Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false });
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: mensajeError(err) });
      }
    });
  }

  eliminar(t: TipoClienteOnu): void {
    Swal.fire({
      icon: 'warning', title: '¿Eliminar tipo?', text: t.nombre,
      showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626'
    }).then(r => {
      if (!r.isConfirmed || !t.id) return;
      this.svc.delete(t.id).subscribe({
        next: () => this.cargar(),
        error: err => Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: mensajeError(err) })
      });
    });
  }
}
