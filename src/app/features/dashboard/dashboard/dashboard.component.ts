import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService }     from '../../../core/services/auth.service';
import { ProductService }  from '../../products/services/product.service';
import { ClientService }   from '../../clients/services/client.service';
import { UserService }     from '../../users/services/user.service';
import { OnuService }      from '../../onus/services/onu.service';
import { AlertService }    from '../../alerts/services/alert.service';
import { MovementsService }from '../../stock/services/movements.service';
import { DeliveryService } from '../../deliveries/services/delivery.service';
import { ExistingService } from '../../stock/services/existing.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private auth      = inject(AuthService);
  private prodSvc   = inject(ProductService);
  private cliSvc    = inject(ClientService);
  private userSvc   = inject(UserService);
  private onuSvc    = inject(OnuService);
  private alertSvc  = inject(AlertService);
  private movSvc    = inject(MovementsService);
  private delSvc    = inject(DeliveryService);
  private existSvc  = inject(ExistingService);

  currentUser = this.auth.currentUserSignal;
  loading = signal(true);

  // ── Contadores ────────────────────────────────────────────────
  totalProductos   = signal(0);
  stockCritico     = signal(0);
  totalClientes    = signal(0);
  clientesActivos  = signal(0);
  totalOnus        = signal(0);
  onusDisponibles  = signal(0);
  alertasPendientes= signal(0);
  alertasCriticas  = signal(0);
  totalMovimientos = signal(0);
  movimientosHoy   = signal(0);
  entregasPendientes = signal(0);
  entregasHoy      = signal(0);
  totalTecnicos    = signal(0);
  totalUsuarios    = signal(0);
  valorInventario  = signal(0);

  // ── Actividad reciente (últimos movimientos) ─────────────────
  actividadReciente = signal<any[]>([]);

  // ── Acciones rápidas ─────────────────────────────────────────
  quickActions = [
    { label: 'Nuevo Producto',    icon: 'fa-plus',        route: '/products',        color: '#3b82f6' },
    { label: 'Movimiento',        icon: 'fa-exchange-alt', route: '/stock/movements', color: '#10b981' },
    { label: 'Nueva Entrega',     icon: 'fa-truck',        route: '/deliveries',      color: '#f59e0b' },
    { label: 'Ver Alertas',       icon: 'fa-bell',         route: '/alerts',          color: '#ef4444' },
    { label: 'Nuevo Cliente',     icon: 'fa-user-plus',    route: '/clients',         color: '#8b5cf6' },
    { label: 'Reportes',          icon: 'fa-file-chart-bar', route: '/reports',       color: '#1b6f6f' },
  ];

  hoy = new Date().toLocaleDateString('es-BO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    let pending = 8;
    const done = () => { if (--pending === 0) this.loading.set(false); };

    // Productos
    this.prodSvc.getAll().subscribe({
      next: (p: any[]) => {
        this.totalProductos.set(p.length);
        this.valorInventario.set(p.reduce((s, x) => s + ((x.precio ?? 0) * (x.unidad ?? 0)), 0));
        done();
      }, error: done
    });

    // Stock / Existing
    this.existSvc.getAll().subscribe({
      next: (e: any[]) => {
        this.stockCritico.set(e.filter(x => (x.stockACtual ?? 0) <= (x.stockMinimo ?? 0)).length);
        done();
      }, error: done
    });

    // Clientes
    this.cliSvc.getAll().subscribe({
      next: (c: any[]) => {
        this.totalClientes.set(c.length);
        this.clientesActivos.set(c.filter(x => x.estado === 'ACTIVO').length);
        done();
      }, error: done
    });

    // ONUs
    this.onuSvc.getAll().subscribe({
      next: (o: any[]) => {
        this.totalOnus.set(o.length);
        this.onusDisponibles.set(o.filter(x => x.estado === 'Disponible').length);
        done();
      }, error: done
    });

    // Alertas
    this.alertSvc.getAll().subscribe({
      next: (a: any[]) => {
        this.alertasPendientes.set(a.filter(x => x.estado === 'PENDIENTE').length);
        this.alertasCriticas.set(a.filter(x => x.resultado === 'CRÍTICO').length);
        done();
      }, error: done
    });

    // Movimientos
    this.movSvc.getAll().subscribe({
      next: (m: any[]) => {
        this.totalMovimientos.set(m.length);
        const hoyStr = new Date().toISOString().split('T')[0];
        this.movimientosHoy.set(m.filter(x => x.fecha?.startsWith?.(hoyStr) || String(x.fecha)?.startsWith?.(hoyStr)).length);
        // Últimos 5 para actividad reciente
        const ultimos = [...m].reverse().slice(0, 5).map((x, i) => ({
          id:    x.idMovements ?? i,
          icon:  x.tipo === 'ENTRADA' ? 'fa-arrow-down' : 'fa-arrow-up',
          color: x.tipo === 'ENTRADA' ? '#10b981' : '#ef4444',
          bg:    x.tipo === 'ENTRADA' ? '#d1fae5' : '#fee2e2',
          title: x.tipo === 'ENTRADA' ? 'Entrada de stock' : 'Salida de stock',
          desc:  `${x.cantidad ?? 1} u. · ${x.product?.articulo ?? 'Producto'}`,
          user:  x.responsable ?? 'Sistema',
          fecha: x.fecha
        }));
        this.actividadReciente.set(ultimos);
        done();
      }, error: done
    });

    // Entregas
    this.delSvc.getAll().subscribe({
      next: (d: any[]) => {
        this.entregasPendientes.set(d.filter(x => x.estado === 'PENDIENTE').length);
        const hoyStr = new Date().toISOString().split('T')[0];
        this.entregasHoy.set(d.filter(x => String(x.fecha)?.startsWith?.(hoyStr)).length);
        done();
      }, error: done
    });

    // Usuarios
    this.userSvc.getAll().subscribe({
      next: (u: any[]) => {
        const cargo = (x: any) => x.profile?.cargo ?? x.rol?.cargo ?? '';
        this.totalTecnicos.set(u.filter(x => cargo(x).includes('écnico')).length);
        this.totalUsuarios.set(u.length);
        done();
      }, error: done
    });
  }

  formatMoneda(v: number): string {
    return new Intl.NumberFormat('es-BO', { style:'currency', currency:'BOB', minimumFractionDigits:0 }).format(v);
  }
}
