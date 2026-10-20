import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { OnuService } from '../services/onu.service';
import { OnuOperacionesService, hoyISO, mensajeError, nombreUsuario } from '../services/onu-operaciones.service';
import { UserService } from '../../users/services/user.service';
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
  styleUrls: ['./onu-assignment.component.css']
})
export class OnuAsignarComponent implements OnInit {
  private onuService = inject(OnuService);
  private operaciones = inject(OnuOperacionesService);
  private userService = inject(UserService);

  onus = signal<Onu[]>([]);
  usuarios = signal<string[]>([]);
  detalle = signal<LineaDetalle[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  guardando = signal(false);

  fecha = hoyISO();
  usuario = '';
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
    this.cargar();
    this.userService.getAll().subscribe({
      next: users => this.usuarios.set(users.map(nombreUsuario).sort((a, b) => a.localeCompare(b, 'es'))),
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

  agregar(onu: Onu): void {
    this.detalle.update(l => [...l, { onu, observaciones: '' }]);
  }

  quitar(linea: LineaDetalle): void {
    this.detalle.update(l => l.filter(x => x !== linea));
  }

  registrar(): void {
    if (!this.usuario) {
      Swal.fire({ icon: 'warning', title: 'Falta el usuario', text: 'Selecciona el usuario al que se asignan las ONUs.' });
      return;
    }
    if (!this.detalle().length) {
      Swal.fire({ icon: 'warning', title: 'Detalle vacío', text: 'Agrega al menos una ONU al detalle.' });
      return;
    }

    this.guardando.set(true);
    this.operaciones.asignar({
      fecha: this.fecha,
      usuario: this.usuario,
      observaciones: this.observaciones,
      items: this.detalle().map(l => ({ onuId: l.onu.id!, observaciones: l.observaciones }))
    }).subscribe({
      next: res => {
        this.guardando.set(false);
        Swal.fire({ icon: 'success', title: 'Asignación registrada', text: `${res.length} ONU(s) asignadas a ${this.usuario}.`, timer: 2200, showConfirmButton: false });
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
