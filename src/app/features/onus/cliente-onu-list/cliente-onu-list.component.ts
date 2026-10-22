import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ClienteOnu, ClienteOnuService, TipoClienteOnu, TipoClienteOnuService } from '../services/cliente-onu.service';
import { mensajeError } from '../services/onu-operaciones.service';

@Component({
  selector: 'app-cliente-onu-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './cliente-onu-list.component.html',
  styleUrls: ['../../../shared/onu-pantalla.css']
})
export class ClienteOnuListComponent implements OnInit {
  private svc = inject(ClienteOnuService);
  private tiposSvc = inject(TipoClienteOnuService);

  readonly opcionesPagina = [10, 25, 50, 100];

  clientes = signal<ClienteOnu[]>([]);
  tipos = signal<TipoClienteOnu[]>([]);
  busqueda = signal('');
  porPagina = signal(10);
  pagina = signal(1);
  cargando = signal(false);
  guardando = signal(false);

  // Formulario (modal)
  formAbierto = signal(false);
  editandoId: number | null = null;
  form: ClienteOnu = this.vacio();
  tipoId: number | null = null;

  filtrados = computed(() => {
    const t = this.busqueda().toLowerCase().trim();
    return this.clientes().filter(c => !t || [c.id, c.nombre, c.ci, c.celular, c.direccion, c.numeroContrato, this.nombreTipo(c)]
      .some(v => String(v ?? '').toLowerCase().includes(t)));
  });
  totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.porPagina())));
  visibles = computed(() => {
    const i = (this.pagina() - 1) * this.porPagina();
    return this.filtrados().slice(i, i + this.porPagina());
  });

  ngOnInit(): void {
    this.tiposSvc.getAll().subscribe({ next: t => this.tipos.set(t), error: () => {} });
    this.cargar();
  }

  private vacio(): ClienteOnu {
    return { nombre: '', ci: '', celular: '', direccion: '', ubicacion: '', fechaNacimiento: null, numeroContrato: null };
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.clientes.set(d); this.cargando.set(false); },
      error: () => { this.cargando.set(false); Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los clientes' }); }
    });
  }

  nombreTipo(c: ClienteOnu): string {
    return (c.tipoCliente as TipoClienteOnu | null | undefined)?.nombre ?? '';
  }
  colorTipo(c: ClienteOnu): string {
    return (c.tipoCliente as TipoClienteOnu | null | undefined)?.color ?? '#9ca3af';
  }

  buscar(t: string): void { this.busqueda.set(t); this.pagina.set(1); }
  cambiarPorPagina(v: number): void { this.porPagina.set(Number(v)); this.pagina.set(1); }
  irA(p: number): void { if (p >= 1 && p <= this.totalPaginas()) this.pagina.set(p); }
  desde(): number { return this.filtrados().length ? (this.pagina() - 1) * this.porPagina() + 1 : 0; }
  hasta(): number { return Math.min(this.pagina() * this.porPagina(), this.filtrados().length); }

  nuevo(): void {
    this.editandoId = null;
    this.form = this.vacio();
    this.tipoId = null;
    this.formAbierto.set(true);
  }

  editar(c: ClienteOnu): void {
    this.editandoId = c.id ?? null;
    this.form = { ...c };
    this.tipoId = (c.tipoCliente as TipoClienteOnu | null | undefined)?.id ?? null;
    this.formAbierto.set(true);
  }

  cerrar(): void { this.formAbierto.set(false); }

  guardar(): void {
    if (!this.form.nombre?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Falta el nombre', text: 'Escribe el nombre del cliente.' });
      return;
    }
    const contrato = this.form.numeroContrato as unknown;
    const body: ClienteOnu = {
      ...this.form,
      nombre: this.form.nombre.trim(),
      numeroContrato: contrato === null || contrato === '' || contrato === undefined ? null : Number(contrato),
      fechaNacimiento: this.form.fechaNacimiento || null,
      tipoCliente: this.tipoId ? { id: Number(this.tipoId) } : null
    };
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

  eliminar(c: ClienteOnu): void {
    Swal.fire({
      icon: 'warning', title: '¿Eliminar cliente?', text: c.nombre,
      showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626'
    }).then(r => {
      if (!r.isConfirmed || !c.id) return;
      this.svc.delete(c.id).subscribe({
        next: () => this.cargar(),
        error: err => Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: mensajeError(err) })
      });
    });
  }

  fechaCorta(f?: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
  }

  esUrl(u?: string): boolean { return /^https?:\/\//i.test(u ?? ''); }
}
