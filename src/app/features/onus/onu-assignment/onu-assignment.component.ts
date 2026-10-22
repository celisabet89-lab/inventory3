import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { OnuService } from '../services/onu.service';
import { OnuOperacionesService, cargoDe, hoyISO, mensajeError, nombreUsuario } from '../services/onu-operaciones.service';
import { UserService } from '../../users/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClienteOnu, ClienteOnuService } from '../services/cliente-onu.service';
import { CargoUsuario, TipoDestino } from '../services/onu-operaciones.service';
import { Onu } from '../../../models/onu.model';

interface LineaDetalle {
  onu: Onu;
  observaciones: string;
}

@Component({
  selector: 'app-onu-asignar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './onu-assignment.component.html',
  styleUrls: ['../../../shared/onu-pantalla.css', './onu-assignment.component.css']
})
export class OnuAsignarComponent implements OnInit {
  private onuService = inject(OnuService);
  private operaciones = inject(OnuOperacionesService);
  private userService = inject(UserService);
  private clienteSvc = inject(ClienteOnuService);
  private auth = inject(AuthService);

  readonly cargos: CargoUsuario[] = ['Técnico', 'Administrador', 'Encargado'];
  clientes = signal<ClienteOnu[]>([]);

  onus = signal<Onu[]>([]);
  usuarios = signal<string[]>([]);
  /** Cargo de cada usuario por su nombre, para rellenarlo solo al elegirlo. */
  private cargosPorUsuario = new Map<string, CargoUsuario | ''>();
  detalle = signal<LineaDetalle[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  guardando = signal(false);

  fecha = hoyISO();
  tipoDestino: TipoDestino = 'USUARIO';
  usuario = '';
  cargo: CargoUsuario | '' = '';
  empresa = '';
  clienteId: number | null = null;
  observaciones = '';

  /** ONUs disponibles que todavía no están en el detalle. */
  disponibles = computed(() => {
    const enDetalle = new Set(this.detalle().map(l => l.onu.id));
    const t = this.busqueda().toLowerCase().trim();
    return this.onus()
      .filter(o => o.estado === 'Disponible' && !enDetalle.has(o.id))
      .filter(o => !t || [o.id, o.marca, o.modelo, o.serial, o.mac, (o as any).almacen]
        .some(v => String(v ?? '').toLowerCase().includes(t)));
  });

  ngOnInit(): void {
    // El usuario que está usando el sistema queda seleccionado (y su cargo, si se reconoce)
    const actual = this.auth.getCurrentUser();
    if (actual) {
      this.usuario = nombreUsuario(actual);
      this.cargo = cargoDe(actual);
    }
    this.cargar();
    this.clienteSvc.getAll().subscribe({ next: c => this.clientes.set(c), error: () => this.clientes.set([]) });
    this.userService.getAll().subscribe({
      next: users => {
        users.forEach(u => this.cargosPorUsuario.set(nombreUsuario(u), cargoDe(u)));
        const nombres = new Set(users.map(nombreUsuario));
        if (this.usuario) nombres.add(this.usuario);
        this.usuarios.set([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
      },
      error: () => this.usuarios.set([])
    });
  }

  /** Al elegir un usuario, su cargo (Técnico, Administrador, Encargado) se coloca solo. */
  alElegirUsuario(): void {
    this.cargo = this.cargosPorUsuario.get(this.usuario) ?? '';
  }

  cargar(): void {
    this.cargando.set(true);
    this.onuService.getAll().subscribe({
      next: data => { this.onus.set(data); this.cargando.set(false); },
      error: () => {
        this.cargando.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las ONUs' });
      }
    });
  }

  agregar(onu: Onu): void {
    this.detalle.update(l => [...l, { onu, observaciones: '' }]);
  }

  quitar(linea: LineaDetalle): void {
    this.detalle.update(l => l.filter(x => x !== linea));
  }

  registrar(): void {
    let destino = '';
    if (this.tipoDestino === 'USUARIO') {
      if (!this.usuario) {
        Swal.fire({ icon: 'warning', title: 'Falta el usuario', text: 'Selecciona el usuario al que se asignan las ONUs.' });
        return;
      }
      if (!this.cargo) {
        Swal.fire({ icon: 'warning', title: 'Falta el cargo', text: 'Indica si es Técnico, Administrador o Encargado.' });
        return;
      }
      destino = `${this.cargo} ${this.usuario}`;
    } else if (this.tipoDestino === 'EMPRESA') {
      if (!this.empresa.trim()) {
        Swal.fire({ icon: 'warning', title: 'Falta la empresa', text: 'Escribe el nombre de la empresa.' });
        return;
      }
      destino = `la empresa ${this.empresa.trim()}`;
    } else {
      const c = this.clientes().find(x => x.id === Number(this.clienteId));
      if (!c) {
        Swal.fire({ icon: 'warning', title: 'Falta el cliente', text: 'Selecciona el cliente.' });
        return;
      }
      destino = `el cliente ${c.nombre}`;
    }
    if (!this.detalle().length) {
      Swal.fire({ icon: 'warning', title: 'Detalle vacío', text: 'Agrega al menos una ONU al detalle.' });
      return;
    }

    this.guardando.set(true);
    this.operaciones.asignar({
      fecha: this.fecha,
      tipoDestino: this.tipoDestino,
      usuario: this.tipoDestino === 'USUARIO' ? this.usuario : undefined,
      cargo: this.tipoDestino === 'USUARIO' && this.cargo ? this.cargo : undefined,
      empresa: this.tipoDestino === 'EMPRESA' ? this.empresa.trim() : undefined,
      clienteId: this.tipoDestino === 'CLIENTE' && this.clienteId ? Number(this.clienteId) : undefined,
      observaciones: this.observaciones,
      items: this.detalle().map(l => ({ onuId: l.onu.id!, observaciones: l.observaciones }))
    }).subscribe({
      next: res => {
        this.guardando.set(false);
        Swal.fire({ icon: 'success', title: 'Asignación registrada', text: this.tipoDestino === 'CLIENTE' ? `${res.length} ONU(s) instaladas en ${destino}.` : `${res.length} ONU(s) asignadas a ${destino}.`, timer: 2200, showConfirmButton: false });
        this.detalle.set([]);
        this.observaciones = '';
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        Swal.fire({ icon: 'error', title: 'No se pudo registrar', text: mensajeError(err) });
      }
    });
  }
}
