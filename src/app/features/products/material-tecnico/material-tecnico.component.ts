import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { ProductService } from '../services/product.service';
import { OnuOperacionesService, cargoDe, mensajeError, nombreUsuario } from '../../onus/services/onu-operaciones.service';
import { OnuService } from '../../onus/services/onu.service';
import { Onu } from '../../../models/onu.model';
import { AsignacionMaterial, MaterialTecnicoService } from '../services/material-tecnico.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { imprimirRecibo, usuarioEmisor } from '../../../shared/documento/recibo.util';

declare const BarcodeDetector: any;

@Component({
  selector: 'app-material-tecnico',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: '../material-tecnico/material-tecnico.component.html',
  styleUrls: ['../../../shared/onu-pantalla.css', '../material-tecnico/material-tecnico.component.css']
})
export class MaterialTecnicoComponent implements OnInit, OnDestroy {
  private svc = inject(MaterialTecnicoService);
  private auth = inject(AuthService);
  private onuSvc = inject(OnuService);
  private onuOps = inject(OnuOperacionesService);
  private userSvc = inject(UserService);
  private productSvc = inject(ProductService);

  /** El técnico solo ve y gestiona lo que tiene a su nombre. */
  readonly esTecnico = this.auth.rol() === 'TECNICO';

  asignaciones = signal<AsignacionMaterial[]>([]);
  tecnicos = signal<{ id: number; nombre: string }[]>([]);
  materiales = signal<any[]>([]);

  // ---- ONU's que se entregan junto con el material ----
  onusTodas = signal<Onu[]>([]);
  onusElegidas = signal<Onu[]>([]);
  codigoOnu = signal('');
  busquedaOnu = signal('');
  /** Cambia cada vez que se escribe en la MAC, para filtrar la lista en vivo. */
  macTick = signal(0);
  selectorOnuAbierto = signal(false);
  /** ONU's disponibles que aún no se eligieron. */
  onusDisponibles = computed(() => {
    const elegidas = new Set(this.onusElegidas().map(o => o.id));
    const t = this.busquedaOnu().toLowerCase().trim();
    this.macTick();
    const macParcial = this.macParts.join('').toLowerCase();
    return this.onusTodas()
      .filter(o => o.estado === 'Disponible' && !elegidas.has(o.id))
      .filter(o => !macParcial || String(o.mac ?? '').toLowerCase().replace(/[^0-9a-z]/g, '').includes(macParcial))
      .filter(o => !t || [o.id, o.marca, o.modelo, o.serial, o.mac, o.codigoQR]
        .some(v => String(v ?? '').toLowerCase().includes(t) || String(v ?? '').toLowerCase().replace(/[^0-9a-z]/g, '').includes(t.replace(/[^0-9a-z]/g, ''))));
  });
  cargando = signal(false);
  guardando = signal(false);
  formAbierto = signal(false);

  busqueda = signal('');
  filtroEstado = signal('');
  filtroTecnico = signal<number | ''>('');
  detalleAbierto = signal<AsignacionMaterial | null>(null);

  form = { tecnicoId: 0, destino: '' };

  /** Carrito de materiales de la entrega actual. */
  lineas = signal<{ productoId: number; cantidad: number }[]>([]);
  nuevoMaterial = { productoId: 0, cantidad: 1 };
  busquedaMat = signal('');
  codigoEscaneado = signal('');

  /** Material elegido en la lista (método, no computed: `nuevoMaterial` no es un signal). */
  materialElegido(): any | null {
    return this.materiales().find(m => m.idProducto === Number(this.nuevoMaterial.productoId)) ?? null;
  }

  /** Materiales aún no agregados al carrito (y filtrados por la búsqueda). */
  disponibles = computed(() => {
    const usados = new Set(this.lineas().map(l => l.productoId));
    const t = this.busquedaMat().toLowerCase().trim();
    return this.materiales().filter(m => !usados.has(m.idProducto) && (!t || String(m.articulo).toLowerCase().includes(t)));
  });

  lineasDetalle = computed(() => this.lineas().map(l => {
    const m = this.materiales().find(x => x.idProducto === l.productoId);
    return { ...l, articulo: m?.articulo ?? '—', foto: m?.foto as string | undefined, stock: (m?.unidad ?? 0) as number };
  }));
  totalUnidades = computed(() => this.lineas().reduce((s, l) => s + (Number(l.cantidad) || 0), 0));

  filtradas = computed(() => {
    const t = this.busqueda().toLowerCase().trim();
    const est = this.filtroEstado();
    const tec = this.filtroTecnico();
    return this.asignaciones().filter(a =>
      (!est || a.estado === est) &&
      (!tec || a.tecnicoId === Number(tec)) &&
      (!t || `${a.tecnicoNombre} ${a.producto?.articulo ?? ''} ${a.destino ?? ''}`.toLowerCase().includes(t)));
  });

  /** Una sola fila por entrega: mismo técnico, quien entrega y minuto de registro. */
  grupos = computed(() => {
    const mapa = new Map<string, { clave: string; items: AsignacionMaterial[] }>();
    for (const a of this.filtradas()) {
      const clave = `${a.tecnicoId}|${a.asignadoPor ?? ''}|${(a.fecha ?? '').slice(0, 16)}`;
      const g = mapa.get(clave) ?? { clave, items: [] };
      g.items.push(a);
      mapa.set(clave, g);
    }
    return Array.from(mapa.values());
  });

  resumen = computed(() => {
    const l = this.asignaciones();
    return {
      entregas: l.length,
      enManos: l.reduce((s, a) => s + Math.max(a.pendiente ?? 0, 0), 0),
      usado: l.reduce((s, a) => s + (a.cantidadUsada ?? 0), 0),
      devuelto: l.reduce((s, a) => s + (a.cantidadDevuelta ?? 0), 0)
    };
  });

  private get miId(): number | undefined {
    const u: any = this.auth.getCurrentUser();
    return u?.idUser ?? u?.idUsuario ?? u?.userId ?? u?.id;
  }

  ngOnInit(): void {
    this.cargar();
    if (!this.esTecnico) this.cargarCatalogos();
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc.getAll(this.esTecnico ? this.miId : undefined).subscribe({
      next: d => { this.asignaciones.set(d); this.cargando.set(false); },
      error: e => {
        this.cargando.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: mensajeError(e, 'No se pudieron cargar las asignaciones') });
      }
    });
  }

  /** Los productos de categoría ONU no son material: las ONU's se entregan por su MAC. */
  private esCategoriaOnu(p: any): boolean {
    const c = p?.categoria;
    const nombre = typeof c === 'string' ? c : (c?.nombre ?? c?.name ?? '');
    return /\bonus?\b/i.test(String(nombre).replace(/['’]/g, ''));
  }

  private cargarCatalogos(): void {
    this.userSvc.getAll().subscribe({
      next: (us: any[]) => this.tecnicos.set(
        us.filter(u => cargoDe(u) === 'Técnico')
          .map(u => ({ id: (u.idUser ?? u.idUsuario ?? u.id) as number, nombre: nombreUsuario(u) }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))),
      error: () => {}
    });
    this.onuSvc.getAll().subscribe({ next: o => this.onusTodas.set(o), error: () => {} });
    this.productSvc.getAll().subscribe({
      next: ps => this.materiales.set(ps.filter(p => (p.unidad ?? 0) > 0 && !this.esCategoriaOnu(p)).sort((a, b) => String(a.articulo).localeCompare(String(b.articulo), 'es'))),
      error: () => {}
    });
  }

  nueva(): void {
    this.form = { tecnicoId: 0, destino: '' };
    this.lineas.set([]);
    this.nuevoMaterial = { productoId: 0, cantidad: 1 };
    this.busquedaMat.set('');
    this.onusElegidas.set([]);
    this.macParts = ['', '', '', '', '', ''];
    this.onuSvc.getAll().subscribe({ next: o => this.onusTodas.set(o), error: () => {} });
    this.formAbierto.set(true);
  }

  cancelar(): void { this.formAbierto.set(false); }

  agregarLinea(): void {
    const m = this.materialElegido();
    const cant = Number(this.nuevoMaterial.cantidad);
    if (!m) { Swal.fire({ icon: 'warning', title: 'Falta el material', text: 'Elige un material para agregarlo.' }); return; }
    if (!cant || cant <= 0) { Swal.fire({ icon: 'warning', title: 'Cantidad inválida', text: 'Debe ser mayor a 0.' }); return; }
    if (cant > (m.unidad ?? 0)) { Swal.fire({ icon: 'warning', title: 'Stock insuficiente', text: `Solo hay ${m.unidad} de ${m.articulo}.` }); return; }
    this.lineas.update(l => [...l, { productoId: m.idProducto, cantidad: cant }]);
    this.nuevoMaterial = { productoId: 0, cantidad: 1 };
  }

  quitarLinea(productoId: number): void {
    this.lineas.update(l => l.filter(x => x.productoId !== productoId));
  }

  cambiarCantidad(productoId: number, valor: number): void {
    this.lineas.update(l => l.map(x => x.productoId === productoId ? { ...x, cantidad: valor } : x));
  }

  asignar(): void {
    const tec = this.tecnicos().find(t => t.id === Number(this.form.tecnicoId));
    if (!tec) { Swal.fire({ icon: 'warning', title: 'Falta el técnico', text: 'Elige a quién se le entrega el material.' }); return; }

    // Si dejó un material elegido sin pulsar "Agregar", lo incluimos.
    if (this.nuevoMaterial.productoId) this.agregarLinea();
    const detalle = this.lineasDetalle();
    if (!detalle.length && !this.onusElegidas().length) { Swal.fire({ icon: 'warning', title: 'Entrega vacía', text: 'Agrega al menos un material o una ONU.' }); return; }
    const mala = detalle.find(l => !l.cantidad || l.cantidad <= 0 || l.cantidad > l.stock);
    if (mala) { Swal.fire({ icon: 'warning', title: 'Revisa las cantidades', text: `${mala.articulo}: ingresa entre 1 y ${mala.stock}.` }); return; }

    const yo: any = this.auth.getCurrentUser();
    const base = { tecnicoId: tec.id, tecnicoNombre: tec.nombre, destino: this.form.destino.trim(), asignadoPor: nombreUsuario(yo), cargoAsignador: cargoDe(yo) };
    this.guardando.set(true);

    // Una asignación por material; se envían en paralelo y se informa cuáles fallaron.
    const onus = this.onusElegidas();
    const pedidoOnus$ = onus.length
      ? this.onuOps.asignar({
        tipoDestino: 'USUARIO', usuario: tec.nombre, cargo: 'Técnico',
        observaciones: this.form.destino.trim(),
        items: onus.map(o => ({ onuId: o.id!, observaciones: '' }))
      }).pipe(map(() => ({ ok: true, error: '' })), catchError(e => of({ ok: false, error: mensajeError(e) })))
      : of({ ok: true, error: '' });

    forkJoin([
      detalle.length ? forkJoin(detalle.map(l =>
        this.svc.asignar({ ...base, productoId: l.productoId, cantidad: Number(l.cantidad) }).pipe(
          map(() => ({ ok: true, articulo: l.articulo, error: '' })),
          catchError(e => of({ ok: false, articulo: l.articulo, error: mensajeError(e) }))
        )
      )) : of([] as { ok: boolean; articulo: string; error: string }[]),
      pedidoOnus$
    ]).subscribe(([res, resOnu]) => {
      this.guardando.set(false);
      const fallos = res.filter(r => !r.ok);
      const ok = res.length - fallos.length;
      if (!resOnu.ok) {
        Swal.fire({ icon: 'error', title: 'No se entregaron las ONU\'s', text: resOnu.error });
      } else if (onus.length) {
        this.onusElegidas.set([]);
      }
      if (!fallos.length && resOnu.ok) {
        this.formAbierto.set(false);
        Swal.fire({ icon: 'success', title: 'Entrega registrada', text: `${ok} material(es)` + (onus.length ? ` y ${onus.length} ONU(s)` : '') + ` para ${tec.nombre}`, timer: 2000, showConfirmButton: false });
      } else if (fallos.length) {
        // Se conservan en el carrito solo los que fallaron para reintentar.
        const fallaron = new Set(detalle.filter(l => fallos.some(f => f.articulo === l.articulo)).map(l => l.productoId));
        this.lineas.update(l => l.filter(x => fallaron.has(x.productoId)));
        Swal.fire({
          icon: ok ? 'warning' : 'error',
          title: ok ? `Entregados ${ok}, fallaron ${fallos.length}` : 'No se pudo entregar',
          html: fallos.map(f => `<div style="text-align:left"><b>${f.articulo}:</b> ${f.error}</div>`).join('')
        });
      }
      this.cargar();
      this.cargarCatalogos();
    });
  }

  /** El técnico confirma que recibió físicamente el material. */
  async confirmar(a: AsignacionMaterial): Promise<void> {
    const r = await Swal.fire({
      title: 'Confirmar recepción',
      text: `¿Recibiste ${a.cantidad} × ${a.producto?.articulo ?? 'material'}?`,
      icon: 'question', showCancelButton: true, confirmButtonColor: '#1b6f6f',
      confirmButtonText: 'Sí, lo recibí', cancelButtonText: 'Cancelar'
    });
    if (!r.isConfirmed) return;
    this.svc.confirmar(a.id, nombreUsuario(this.auth.getCurrentUser() as any)).subscribe({
      next: () => this.cargar(),
      error: e => Swal.fire({ icon: 'error', title: 'No se pudo confirmar', text: mensajeError(e) })
    });
  }

  /** Escáner (lector USB o teclado): al pulsar Enter busca el producto por su código de barras. */
  escanear(): void {
    const codigo = this.codigoEscaneado().trim();
    if (!codigo) return;
    this.codigoEscaneado.set('');
    const m = this.materiales().find(x => String(x.codigoBarras ?? '').trim() === codigo);
    if (!m) { Swal.fire({ icon: 'warning', title: 'Código no encontrado', text: `Ningún material con stock tiene el código ${codigo}.`, timer: 2200, showConfirmButton: false }); return; }
    const actual = this.lineas().find(l => l.productoId === m.idProducto);
    if (actual) {
      if (actual.cantidad + 1 > (m.unidad ?? 0)) { Swal.fire({ icon: 'warning', title: 'Stock insuficiente', text: `Solo hay ${m.unidad} de ${m.articulo}.` }); return; }
      this.cambiarCantidad(m.idProducto, actual.cantidad + 1);
    } else {
      this.lineas.update(l => [...l, { productoId: m.idProducto, cantidad: 1 }]);
    }
  }

  // ---- MAC en 6 bloques (XX:XX:XX:XX:XX:XX) ----
  readonly macIdx = [0, 1, 2, 3, 4, 5];
  macParts: string[] = ['', '', '', '', '', ''];
  scannerAbierto = signal(false);
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;
  private stream: MediaStream | null = null;
  private scanInterval: any = null;

  macValor(i: number): string { return this.macParts[i]; }

  alEscribirMac(ev: Event, i: number): void {
    const input = ev.target as HTMLInputElement;
    const limpio = (input.value ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (limpio.length > 2) { this.ponerMac(limpio); return; }   // pegaron la MAC completa
    this.macParts[i] = limpio;
    input.value = limpio;
    this.macTick.update(n => n + 1);
    if (limpio.length === 2 && i < 5) {
      (document.querySelectorAll('.mt-mac-part')[i + 1] as HTMLInputElement | undefined)?.focus();
    }
    this.buscarSiCompleta();
  }

  alPegarMac(ev: ClipboardEvent): void {
    const texto = ev.clipboardData?.getData('text') ?? '';
    const limpio = texto.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (limpio.length >= 12) { ev.preventDefault(); this.ponerMac(limpio); }
  }

  private ponerMac(valor: string): void {
    const limpio = (valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    for (let i = 0; i < 6; i++) this.macParts[i] = limpio.substring(i * 2, i * 2 + 2);
    this.macTick.update(n => n + 1);
    this.buscarSiCompleta();
  }

  private buscarSiCompleta(): void {
    if (this.macParts.some(p => p.length !== 2)) return;
    const mac = this.macParts.join('');
    this.macParts = ['', '', '', '', '', ''];
    this.macTick.update(n => n + 1);
    this.agregarOnuPorCodigo(mac);
  }

  /** Busca por MAC (sin importar los separadores), serial, QR o código interno. */
  private agregarOnuPorCodigo(codigo: string, reintento = false): void {
    const norm = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    const c = norm(codigo);
    const o = this.onusTodas().find(x => [x.mac, x.serial, x.codigoQR, x.id].some(v => norm(v) === c));
    if (!o) {
      if (!reintento) {
        // Puede ser una ONU recién registrada: se recarga la lista y se vuelve a buscar.
        this.onuSvc.getAll().subscribe({
          next: l => { this.onusTodas.set(l); this.agregarOnuPorCodigo(codigo, true); },
          error: () => this.agregarOnuPorCodigo(codigo, true)
        });
        return;
      }
      Swal.fire({ icon: 'warning', title: 'ONU no encontrada', text: `No hay ninguna ONU registrada con el código ${codigo}. Revisa la MAC o elige de la lista de disponibles.` });
      return;
    }
    if (o.estado !== 'Disponible') { Swal.fire({ icon: 'warning', title: 'ONU no disponible', text: `Esa ONU está en estado «${o.estado}»${o.almacen ? ' (' + o.almacen + ')' : ''}.` }); return; }
    if (this.onusElegidas().some(x => x.id === o.id)) { Swal.fire({ icon: 'info', title: 'Ya agregada', timer: 1500, showConfirmButton: false }); return; }
    this.onusElegidas.update(l => [...l, o]);
  }

  // ---- Cámara ----
  async abrirCamara(): Promise<void> {
    this.scannerAbierto.set(true);
    setTimeout(() => this.iniciarCamara(), 150);
  }

  private async iniciarCamara(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = this.videoEl?.nativeElement;
      if (!video) return;
      video.srcObject = this.stream;
      await video.play();
      if (typeof BarcodeDetector === 'undefined') {
        Swal.fire({ icon: 'warning', title: 'Escáner no disponible', text: 'Usa Chrome o Edge, o escribe la MAC.' });
        this.cerrarCamara(); return;
      }
      const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'data_matrix'] });
      this.scanInterval = setInterval(async () => {
        if (video.readyState < 2) return;
        try {
          const r = await detector.detect(video);
          if (r.length) {
            if (navigator.vibrate) navigator.vibrate(150);
            const valor = String(r[0].rawValue);
            this.cerrarCamara();
            this.agregarOnuPorCodigo(valor);
          }
        } catch {}
      }, 300);
    } catch {
      Swal.fire({ icon: 'error', title: 'Sin acceso a la cámara', text: 'Permite el acceso a la cámara en tu navegador.' });
      this.cerrarCamara();
    }
  }

  cerrarCamara(): void {
    if (this.scanInterval) { clearInterval(this.scanInterval); this.scanInterval = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.scannerAbierto.set(false);
  }

  ngOnDestroy(): void { this.cerrarCamara(); }

  abrirSelectorOnu(): void { this.macParts = ['', '', '', '', '', '']; this.busquedaOnu.set(''); this.selectorOnuAbierto.set(true); }
  cerrarSelectorOnu(): void { this.selectorOnuAbierto.set(false); }
  agregarOnu(o: Onu): void { this.onusElegidas.update(l => [...l, o]); }
  quitarOnu(o: Onu): void { this.onusElegidas.update(l => l.filter(x => x.id !== o.id)); }

  async registrar(a: AsignacionMaterial, tipo: 'uso' | 'devolver'): Promise<void> {
    const uso = tipo === 'uso';
    const r = await Swal.fire({
      title: uso ? 'Registrar material usado' : 'Devolver material al almacén',
      html: `<p style="margin:0 0 10px;color:#6b7280">${a.producto?.articulo ?? ''} · en poder del técnico: <b>${a.pendiente}</b></p>
             <input id="sw-cant" type="number" min="1" max="${a.pendiente}" value="1" class="swal2-input" placeholder="Cantidad">
             <input id="sw-det" type="text" class="swal2-input" placeholder="${uso ? 'Cliente / instalación (opcional)' : 'Motivo (opcional)'}">`,
      showCancelButton: true,
      confirmButtonText: uso ? 'Registrar uso' : 'Devolver',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1b6f6f',
      preConfirm: () => {
        const cant = Number((document.getElementById('sw-cant') as HTMLInputElement).value);
        if (!cant || cant <= 0 || cant > a.pendiente) { Swal.showValidationMessage(`Ingresa una cantidad entre 1 y ${a.pendiente}`); return false; }
        return { cant, det: (document.getElementById('sw-det') as HTMLInputElement).value.trim() };
      }
    });
    if (!r.isConfirmed || !r.value) return;
    const { cant, det } = r.value as { cant: number; det: string };
    const peticion = uso ? this.svc.registrarUso(a.id, cant, det) : this.svc.devolver(a.id, cant, det);
    peticion.subscribe({
      next: () => { this.cargar(); if (!this.esTecnico) this.cargarCatalogos(); },
      error: e => Swal.fire({ icon: 'error', title: 'Error', text: mensajeError(e) })
    });
  }

  async anular(a: AsignacionMaterial): Promise<void> {
    const r = await Swal.fire({
      title: '¿Anular la entrega?', text: `Los ${a.cantidad} ${a.producto?.articulo ?? ''} vuelven al stock.`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, anular', cancelButtonText: 'Cancelar'
    });
    if (!r.isConfirmed) return;
    this.svc.anular(a.id).subscribe({
      next: () => { this.cargar(); this.cargarCatalogos(); },
      error: e => Swal.fire({ icon: 'error', title: 'No se pudo anular', text: mensajeError(e) })
    });
  }

  /** Acta de entrega de material (se imprime con el recibo compartido). */
  imprimirActa(a: AsignacionMaterial): void {
    const fmt = (f?: string) => f ? new Date(f).toLocaleString('es-BO') : '—';
    imprimirRecibo({
      titulo: 'Acta de entrega de material',
      numero: `MT-${a.id}`,
      emitidoPor: usuarioEmisor(),
      datos: [
        { etiqueta: 'Técnico', valor: a.tecnicoNombre },
        { etiqueta: 'Fecha de entrega', valor: fmt(a.fecha) },
        { etiqueta: 'Entregado por', valor: [a.asignadoPor, a.cargoAsignador && `(${a.cargoAsignador})`].filter(Boolean).join(' ') },
        { etiqueta: 'Destino / instalación', valor: a.destino || '—' }
      ],
      tablas: [{
        titulo: 'Material entregado',
        columnas: [{ texto: 'Material' }, { texto: 'Entregado', num: true }, { texto: 'Usado', num: true }, { texto: 'Devuelto', num: true }, { texto: 'En poder', num: true }],
        filas: [[a.producto?.articulo ?? '—', a.cantidad, a.cantidadUsada, a.cantidadDevuelta, a.pendiente]]
      }],
      observaciones: a.bitacora ? a.bitacora.split('\n').slice(-3).join(' | ') : undefined,
      sello: a.estado === 'CERRADO' ? { texto: 'CERRADO', tipo: 'ok' } : undefined,
      firmas: ['Entregó (almacén)', 'Recibí conforme (técnico)']
    });
  }

  ver(a: AsignacionMaterial): void { this.detalleAbierto.set(a); }
  cerrarDetalle(): void { this.detalleAbierto.set(null); }

  etiqueta(e: string): string {
    return e === 'CERRADO' ? 'Cerrado' : e === 'PARCIAL' ? 'En uso' : 'Entregado';
  }
  claseEstado(e: string): string {
    return e === 'CERRADO' ? 'badge-secondary' : e === 'PARCIAL' ? 'badge-warning' : 'badge-info';
  }
  puedeConfirmar(a: AsignacionMaterial): boolean { return this.esTecnico && !a.fechaConfirmacion; }
  puedeAnular(a: AsignacionMaterial): boolean { return !this.esTecnico && !a.cantidadUsada && !a.cantidadDevuelta; }
}
