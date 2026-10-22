import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { OnuService } from '../services/onu.service';
import { OnuOperacionesService, cargoDe, hoyISO, mensajeError, nombreCliente, nombreUsuario } from '../services/onu-operaciones.service';
import { UserService } from '../../users/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { Onu } from '../../../models/onu.model';

interface LineaDetalle {
  onu: Onu;
  observaciones: string;
}

@Component({
  selector: 'app-onu-recojo',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './onu-recojo.component.html',
  styleUrls: [ '../../../shared/onu-pantalla.css', './onu-recojo.component.css']
})
export class OnuRecojoComponent implements OnInit {
  private onuService = inject(OnuService);
  private operaciones = inject(OnuOperacionesService);
  private userService = inject(UserService);
  private auth = inject(AuthService);

  onus = signal<Onu[]>([]);
  usuarios = signal<string[]>([]);
  detalle = signal<LineaDetalle[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  guardando = signal(false);

  fecha = hoyISO();
  usuario = '';
  observaciones = '';

  /** ONUs asignadas a clientes ONU (en poder del cliente) que todavía no están en el detalle. */
  disponibles = computed(() => {
    const enDetalle = new Set(this.detalle().map(l => l.onu.id));
    const t = this.busqueda().toLowerCase().trim();
    return this.onus()
      .filter(o => (o.estado === 'Instalado' || o.estado === 'Asignada') && o.tipoPortador === 'Cliente' && !enDetalle.has(o.id))
      .filter(o => !t || [o.id, o.marca, o.modelo, o.serial, o.mac, o.contrato, nombreCliente(o)]
        .some(v => String(v ?? '').toLowerCase().includes(t)));
  });

  ngOnInit(): void {
    this.cargar();
    this.userService.getAll().subscribe({
      next: users => {
        // Solo los técnicos recogen ONUs; si ningún usuario tiene cargo reconocido, se muestran todos
        const tecnicos = users.filter(u => cargoDe(u) === 'Técnico');
        const lista = (tecnicos.length ? tecnicos : users).map(nombreUsuario);
        this.usuarios.set([...new Set(lista)].sort((a, b) => a.localeCompare(b, 'es')));
        const actual = this.auth.getCurrentUser();
        if (actual && !this.usuario && this.usuarios().includes(nombreUsuario(actual))) {
          this.usuario = nombreUsuario(actual);
        }
      },
      error: () => this.usuarios.set([])
    });
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

  cliente(onu: Onu): string {
    return nombreCliente(onu) || '—';
  }

  agregar(onu: Onu): void {
    this.detalle.update(l => [...l, { onu, observaciones: '' }]);
  }

  quitar(linea: LineaDetalle): void {
    this.detalle.update(l => l.filter(x => x !== linea));
  }

  registrar(): void {
    if (!this.usuario) {
      Swal.fire({ icon: 'warning', title: 'Falta el usuario', text: 'Selecciona el técnico que recoge las ONUs.' });
      return;
    }
    if (!this.detalle().length) {
      Swal.fire({ icon: 'warning', title: 'Detalle vacío', text: 'Agrega al menos una ONU al detalle.' });
      return;
    }

    this.guardando.set(true);
    this.operaciones.recojo({
      fecha: this.fecha,
      usuario: this.usuario,
      observaciones: this.observaciones,
      items: this.detalle().map(l => ({ onuId: l.onu.id!, observaciones: l.observaciones }))
    }).subscribe({
      next: res => {
        this.guardando.set(false);
        Swal.fire({ icon: 'success', title: 'Recojo registrado', text: `${res.length} ONU(s) recogidas por ${this.usuario}. Pasan a revisión en Mantenimiento.`, timer: 2600, showConfirmButton: false });
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
