import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { OnuService } from '../services/onu.service';
import { OnuOperacionesService, hoyISO, mensajeError } from '../services/onu-operaciones.service';
import { ALMACENES, ESTADOS_MANTENIMIENTO } from '../onu.constants';
import { Onu } from '../../../models/onu.model';

type EstadoDiagnostico = 'Disponible' | 'Defectuoso' | 'Observado' | 'Mantenimiento';

@Component({
  selector: 'app-onu-mantenimiento',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './onu-mantenimiento.component.html',
  styleUrls: ['../../../shared/onu-pantalla.css', './onu-mantenimiento.component.css']
})
export class OnuMantenimientoComponent implements OnInit {
  private onuService = inject(OnuService);
  private operaciones = inject(OnuOperacionesService);

  readonly almacenes = ALMACENES;
  readonly estadosResultado: EstadoDiagnostico[] = ['Disponible', 'Defectuoso', 'Observado', 'Mantenimiento'];
  readonly opcionesPagina = [10, 25, 50, 100];

  onus = signal<Onu[]>([]);
  busqueda = signal('');
  porPagina = signal(10);
  pagina = signal(1);
  cargando = signal(false);
  guardando = signal(false);

  /** Opciones de resultado con su ícono y explicación. */
  readonly resultados: { valor: EstadoDiagnostico; icono: string; texto: string; clase: string }[] = [
    { valor: 'Disponible',    icono: 'fa-circle-check',        texto: 'Funciona bien: vuelve al stock',   clase: 'ok' },
    { valor: 'Mantenimiento', icono: 'fa-screwdriver-wrench',  texto: 'Sigue en reparación',              clase: 'warn' },
    { valor: 'Observado',     icono: 'fa-eye',                 texto: 'Requiere seguimiento',             clase: 'info' },
    { valor: 'Defectuoso',    icono: 'fa-circle-xmark',        texto: 'No tiene arreglo',                 clase: 'bad' }
  ];

  /** Pruebas rápidas: lo marcado se agrega al texto del diagnóstico. */
  readonly pruebasBase = [
    'Potencia óptica correcta', 'Puertos LAN funcionan', 'WiFi emite señal', 'LEDs normales',
    'Enciende y arranca', 'Firmware restablecido', 'Conectores limpios', 'Daño físico visible'
  ];
  pruebas = signal<string[]>([]);
  readonly maxDiagnostico = 500;

  // Modal de diagnóstico
  seleccionada = signal<Onu | null>(null);
  fecha = hoyISO();
  estadoNuevo: EstadoDiagnostico | '' = '';
  diagnostico = '';
  almacen = '';

  /** ONUs que esperan revisión (mantenimiento, reparación o recién recogidas). */
  enMantenimiento = computed(() => {
    const t = this.busqueda().toLowerCase().trim();
    return this.onus()
      .filter(o => ESTADOS_MANTENIMIENTO.includes(o.estado as string))
      .filter(o => !t || [o.id, o.marca, o.modelo, o.serial, o.mac, o.estado, o.observaciones]
        .some(v => String(v ?? '').toLowerCase().includes(t)));
  });

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.enMantenimiento().length / this.porPagina())));

  visibles = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina();
    return this.enMantenimiento().slice(inicio, inicio + this.porPagina());
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.onuService.getAll().subscribe({
      next: data => { this.onus.set(data); this.cargando.set(false); this.pagina.set(1); },
      error: () => {
        this.cargando.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las ONUs' });
      }
    });
  }

  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(1);
  }

  cambiarPorPagina(valor: number): void {
    this.porPagina.set(Number(valor));
    this.pagina.set(1);
  }

  irA(p: number): void {
    if (p >= 1 && p <= this.totalPaginas()) this.pagina.set(p);
  }

  desde(): number {
    return this.enMantenimiento().length ? (this.pagina() - 1) * this.porPagina() + 1 : 0;
  }

  hasta(): number {
    return Math.min(this.pagina() * this.porPagina(), this.enMantenimiento().length);
  }

  claseEstado(estado: string): string {
    if (estado === 'Recogido') return 'badge-secondary';
    return 'badge-warning';
  }

  alternarPrueba(p: string): void {
    this.pruebas.update(l => l.includes(p) ? l.filter(x => x !== p) : [...l, p]);
  }

  elegirResultado(e: EstadoDiagnostico): void {
    this.estadoNuevo = e;
    if (e !== 'Disponible') this.almacen = '';
  }

  /** Diagnóstico final: lo escrito + las pruebas marcadas. */
  private textoDiagnostico(): string {
    const base = this.diagnostico.trim();
    const marcadas = this.pruebas();
    return marcadas.length ? `${base}\nPruebas: ${marcadas.join('; ')}.` : base;
  }

  abrir(onu: Onu): void {
    this.pruebas.set([]);
    this.seleccionada.set(onu);
    this.fecha = hoyISO();
    this.estadoNuevo = '';
    this.diagnostico = '';
    this.almacen = '';
  }

  cerrar(): void {
    this.seleccionada.set(null);
  }

  diagnosticar(): void {
    const onu = this.seleccionada();
    if (!onu?.id) return;

    if (!this.estadoNuevo) {
      Swal.fire({ icon: 'warning', title: 'Falta el estado', text: 'Selecciona el estado de la ONU.' });
      return;
    }
    if (!this.diagnostico.trim()) {
      Swal.fire({ icon: 'warning', title: 'Falta el diagnóstico', text: 'Describe el diagnóstico.' });
      return;
    }
    if (this.estadoNuevo === 'Disponible' && !this.almacen) {
      Swal.fire({ icon: 'warning', title: 'Falta el almacén', text: 'Elige el almacén destino para dejarla disponible.' });
      return;
    }

    this.guardando.set(true);
    this.operaciones.diagnosticar({
      fecha: this.fecha,
      onuId: onu.id,
      estadoNuevo: this.estadoNuevo,
      diagnostico: this.textoDiagnostico(),
      almacen: this.almacen || undefined
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrar();
        Swal.fire({ icon: 'success', title: 'Diagnóstico registrado', text: `La ONU quedó como "${this.estadoNuevo}".`, timer: 2000, showConfirmButton: false });
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        Swal.fire({ icon: 'error', title: 'No se pudo registrar', text: mensajeError(err) });
      }
    });
  }
}
