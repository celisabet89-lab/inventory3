import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Chart } from 'chart.js/auto';
import { AuthService }     from '../../../core/services/auth.service';
import { ProductService }  from '../../products/services/product.service';
import { ClientService }   from '../../clients/services/client.service';
import { UserService }     from '../../users/services/user.service';
import { OnuService }      from '../../onus/services/onu.service';
import { AlertService }    from '../../alerts/services/alert.service';
import { MovementsService }from '../../stock/services/movements.service';
import { DeliveryService } from '../../deliveries/services/delivery.service';
import { ExistingService } from '../../stock/services/existing.service';

interface Kpi {
  etiqueta: string; valor: string | number; icono: string; color: string; ruta: string;
  detalle: string; alerta?: boolean;
}

const ESTADOS_ONU: { clave: string; etiqueta: string; color: string; incluye: string[] }[] = [
  { clave: 'Disponible',    etiqueta: 'Disponibles',    color: '#10b981', incluye: ['Disponible'] },
  { clave: 'Instalado',     etiqueta: 'Instaladas',     color: '#1b6f6f', incluye: ['Instalado'] },
  { clave: 'Asignada',      etiqueta: 'Asignadas',      color: '#3b82f6', incluye: ['Asignada'] },
  { clave: 'Mantenimiento', etiqueta: 'Mantenimiento',  color: '#f59e0b', incluye: ['Mantenimiento', 'En Reparación'] },
  { clave: 'Observado',     etiqueta: 'Observadas',     color: '#f97316', incluye: ['Observado'] },
  { clave: 'Recogido',      etiqueta: 'Recogidas',      color: '#8b5cf6', incluye: ['Recogido'] },
  { clave: 'Defectuoso',    etiqueta: 'Defectuosas',    color: '#ef4444', incluye: ['Defectuoso'] }
];

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Fecha local en formato YYYY-MM-DD (evita el desfase de toISOString con la zona horaria). */
function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  private auth      = inject(AuthService);
  private prodSvc   = inject(ProductService);
  private cliSvc    = inject(ClientService);
  private userSvc   = inject(UserService);
  private onuSvc    = inject(OnuService);
  private alertSvc  = inject(AlertService);
  private movSvc    = inject(MovementsService);
  private delSvc    = inject(DeliveryService);
  private existSvc  = inject(ExistingService);

  @ViewChild('onuChart') onuCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('movChart') movCanvas?: ElementRef<HTMLCanvasElement>;

  currentUser = this.auth.currentUserSignal;
  loading = signal(true);
  kpis = signal<Kpi[]>([]);
  actividadReciente = signal<any[]>([]);
  onusPorEstado = signal<{ etiqueta: string; color: string; cantidad: number }[]>([]);

  stockCritico = signal(0);
  alertasPendientes = signal(0);
  entregasPendientes = signal(0);
  clientesActivos = signal(0);

  private graficos: Chart[] = [];
  private datos: Record<string, any[]> = {};
  private vistaLista = false;

  quickActions = [
    { label: 'Nuevo Producto', icon: 'fa-box',          route: '/productos/lista',       color: '#3b82f6' },
    { label: 'Movimiento',     icon: 'fa-exchange-alt', route: '/movimientos/movimientos', color: '#10b981' },
    { label: 'Registrar ONU',  icon: 'fa-wifi',         route: '/onus/lista',            color: '#1b6f6f' },
    { label: 'Ver Alertas',    icon: 'fa-bell',         route: '/movimientos/alertas',   color: '#ef4444' },
    { label: 'Clientes',       icon: 'fa-user-plus',    route: '/clientes/lista',        color: '#8b5cf6' },
    { label: 'Reportes',       icon: 'fa-chart-line',   route: '/reportes',              color: '#f59e0b' }
  ];

  hoy = new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  saludo(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  nombre(): string {
    const u: any = this.currentUser();
    return u?.profile?.name ?? u?.name ?? u?.email ?? 'Usuario';
  }

  ngAfterViewInit(): void {
    this.vistaLista = true;
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.graficos.forEach(g => g.destroy());
  }

  loadAll(): void {
    this.loading.set(true);
    this.datos = {};
    const fuentes: [string, () => any][] = [
      ['productos',  () => this.prodSvc.getAll()],
      ['stock',      () => this.existSvc.getAll()],
      ['clientes',   () => this.cliSvc.getAll()],
      ['onus',       () => this.onuSvc.getAll()],
      ['alertas',    () => this.alertSvc.getAll()],
      ['movimientos',() => this.movSvc.getAll()],
      ['entregas',   () => this.delSvc.getAll()],
      ['usuarios',   () => this.userSvc.getAll()]
    ];
    let pendientes = fuentes.length;
    const listo = () => { if (--pendientes === 0) this.calcular(); };

    for (const [clave, pedir] of fuentes) {
      pedir().subscribe({
        next: (d: any[]) => { this.datos[clave] = Array.isArray(d) ? d : []; listo(); },
        error: () => { this.datos[clave] = []; listo(); }
      });
    }
  }

  private calcular(): void {
    const d = this.datos;
    const hoyStr = claveDia(new Date());
    const esHoy = (f: any) => String(f ?? '').startsWith(hoyStr);

    const stockCritico = d['stock'].filter(x => (x.stockACtual ?? 0) <= (x.stockMinimo ?? 0)).length;
    const valor = d['productos'].reduce((s, x) => s + ((x.precio ?? 0) * (x.unidad ?? 0)), 0);
    const clientesActivos = d['clientes'].filter(x => x.estado === 'ACTIVO').length;
    const alertasPend = d['alertas'].filter(x => x.estado === 'PENDIENTE');
    const criticas = alertasPend.filter(x => x.resultado === 'CRÍTICO').length;
    const entregasPend = d['entregas'].filter(x => x.estado === 'PENDIENTE').length;
    const cargo = (x: any) => String(x.profile?.cargo ?? x.rol?.cargo ?? x.rol?.nombre ?? '');
    const tecnicos = d['usuarios'].filter(x => /t[eé]cnic/i.test(cargo(x))).length;
    const onuDisp = d['onus'].filter(x => x.estado === 'Disponible').length;
    const onuInst = d['onus'].filter(x => x.estado === 'Instalado').length;
    const movHoy = d['movimientos'].filter(x => esHoy(x.fecha)).length;
    const entHoy = d['entregas'].filter(x => esHoy(x.fecha)).length;

    this.stockCritico.set(stockCritico);
    this.alertasPendientes.set(alertasPend.length);
    this.entregasPendientes.set(entregasPend);
    this.clientesActivos.set(clientesActivos);

    this.kpis.set([
      { etiqueta: 'Productos', valor: d['productos'].length, icono: 'fa-box', color: '#3b82f6', ruta: '/productos/lista',
        detalle: `${stockCritico} con stock crítico`, alerta: stockCritico > 0 },
      { etiqueta: 'Valor del inventario', valor: this.moneda(valor), icono: 'fa-coins', color: '#1b6f6f', ruta: '/movimientos/stock',
        detalle: 'Stock en existencia' },
      { etiqueta: 'Clientes', valor: d['clientes'].length, icono: 'fa-users', color: '#8b5cf6', ruta: '/clientes/lista',
        detalle: `${clientesActivos} activos` },
      { etiqueta: 'ONUs', valor: d['onus'].length, icono: 'fa-wifi', color: '#0d9488', ruta: '/onus/lista',
        detalle: `${onuDisp} disponibles · ${onuInst} instaladas` },
      { etiqueta: 'Alertas pendientes', valor: alertasPend.length, icono: 'fa-bell', color: '#ef4444', ruta: '/movimientos/alertas',
        detalle: criticas ? `${criticas} críticas` : 'Sin críticas', alerta: criticas > 0 },
      { etiqueta: 'Movimientos', valor: d['movimientos'].length, icono: 'fa-exchange-alt', color: '#10b981', ruta: '/movimientos/movimientos',
        detalle: `${movHoy} hoy` },
      { etiqueta: 'Entregas pendientes', valor: entregasPend, icono: 'fa-truck', color: '#f59e0b', ruta: '/deliveries',
        detalle: `${entHoy} hoy` },
      { etiqueta: 'Usuarios', valor: d['usuarios'].length, icono: 'fa-user-cog', color: '#64748b', ruta: '/usuarios/lista',
        detalle: `${tecnicos} técnicos` }
    ]);

    // Actividad reciente: los 6 movimientos más nuevos
    const ordenados = [...d['movimientos']].sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
    this.actividadReciente.set(ordenados.slice(0, 6).map((x, i) => {
      const entrada = x.tipo === 'ENTRADA';
      return {
        id: x.idMovements ?? i,
        icon: entrada ? 'fa-arrow-down' : 'fa-arrow-up',
        color: entrada ? '#059669' : '#dc2626',
        bg: entrada ? '#d1fae5' : '#fee2e2',
        title: entrada ? 'Entrada de stock' : 'Salida de stock',
        desc: `${x.cantidad ?? 1} u. · ${x.product?.articulo ?? 'Producto'}`,
        user: x.responsable ?? 'Sistema',
        fecha: x.fecha
      };
    }));

    // ONUs por estado
    this.onusPorEstado.set(ESTADOS_ONU
      .map(e => ({
        etiqueta: e.etiqueta, color: e.color,
        cantidad: d['onus'].filter(o => e.incluye.includes(o.estado)).length
      }))
      .filter(e => e.cantidad > 0));

    this.loading.set(false);
    // Los gráficos se dibujan cuando el lienzo ya está en pantalla
    setTimeout(() => this.dibujar(), 0);
  }

  private dibujar(): void {
    if (!this.vistaLista) return;
    this.graficos.forEach(g => g.destroy());
    this.graficos = [];

    const estados = this.onusPorEstado();
    if (this.onuCanvas && estados.length) {
      this.graficos.push(new Chart(this.onuCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: estados.map(e => e.etiqueta),
          datasets: [{ data: estados.map(e => e.cantidad), backgroundColor: estados.map(e => e.color), borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } }
      }));
    }

    if (this.movCanvas) {
      const dias: Date[] = [];
      for (let i = 6; i >= 0; i--) { const f = new Date(); f.setDate(f.getDate() - i); dias.push(f); }
      const cuenta = (tipo: string) => dias.map(f => {
        const k = claveDia(f);
        return (this.datos['movimientos'] ?? []).filter(m => String(m.fecha ?? '').startsWith(k) && m.tipo === tipo)
          .reduce((s, m) => s + (Number(m.cantidad) || 1), 0);
      });
      this.graficos.push(new Chart(this.movCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: dias.map(f => `${DIAS[f.getDay()]} ${f.getDate()}`),
          datasets: [
            { label: 'Entradas', data: cuenta('ENTRADA'), backgroundColor: '#10b981', borderRadius: 6, maxBarThickness: 26 },
            { label: 'Salidas',  data: cuenta('SALIDA'),  backgroundColor: '#ef4444', borderRadius: 6, maxBarThickness: 26 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
        }
      }));
    }
  }

  totalOnus(): number { return this.onusPorEstado().reduce((s, e) => s + e.cantidad, 0); }

  moneda(v: number): string {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 0 }).format(v);
  }
}
