import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../services/alert.service';

interface Alert {
  idAlert: number;
  resultado: string;
  descripcion: string;
  fecha: string;
  estado: 'PENDIENTE' | 'GESTIONADA';
  stockActual: number;
  stockMinimo: number;
  emailEnviado: boolean;
  product?: { idProducto: number; articulo: string; categoria: string; foto?: string };
}

interface PedidoModal {
  alerta:        Alert;
  supplierEmail: string;
  supplierName:  string;
  cantidad:      number;
  observaciones: string;
}

@Component({
  selector: 'app-alert-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alert-panel.component.html',
  styleUrls: ['./alert-panel.component.css']
})
export class AlertPanelComponent implements OnInit, OnDestroy {

  alerts: Alert[] = [];
  filteredAlerts: Alert[] = [];
  filtroActivo = 'TODAS';
  cargando    = false;
  verificando = false;
  private intervalId: any;

  showPedidoModal = false;
  enviandoPedido  = false;
  pedido: PedidoModal = this.emptyPedido();

  get totalAlertas()   { return this.alerts.length; }
  get pendientes()     { return this.alerts.filter(a => a.estado === 'PENDIENTE').length; }
  get criticas()       { return this.alerts.filter(a => a.resultado === 'CRÍTICO').length; }
  get gestionadas()    { return this.alerts.filter(a => a.estado === 'GESTIONADA').length; }
  get emailsEnviados() { return this.alerts.filter(a => a.emailEnviado).length; }

  constructor(private alertService: AlertService) {}

  ngOnInit(): void {
    this.loadAlerts();
    this.checkStock();
    this.intervalId = setInterval(() => this.checkStock(), 60000);
  }

  ngOnDestroy(): void { if (this.intervalId) clearInterval(this.intervalId); }

  loadAlerts(): void {
    this.cargando = true;
    this.alertService.getAll().subscribe({
      next: (data: Alert[]) => {
        this.alerts = data.sort((a, b) => {
          if (a.estado === 'PENDIENTE' && b.estado !== 'PENDIENTE') return -1;
          if (a.estado !== 'PENDIENTE' && b.estado === 'PENDIENTE') return 1;
          if (a.resultado === 'CRÍTICO' && b.resultado !== 'CRÍTICO') return -1;
          if (a.resultado !== 'CRÍTICO' && b.resultado === 'CRÍTICO') return 1;
          return 0;
        });
        this.aplicarFiltro(this.filtroActivo);
        this.cargando = false;
      },
      error: () => { this.cargando = false; }
    });
  }

  checkStock(): void {
    this.verificando = true;
    this.alertService.checkStock().subscribe({
      next: () => { this.loadAlerts(); this.verificando = false; },
      error: () => { this.verificando = false; }
    });
  }

  aplicarFiltro(filtro: string): void {
    this.filtroActivo = filtro;
    switch (filtro) {
      case 'PENDIENTES':  this.filteredAlerts = this.alerts.filter(a => a.estado === 'PENDIENTE'); break;
      case 'CRÍTICAS':    this.filteredAlerts = this.alerts.filter(a => a.resultado === 'CRÍTICO'); break;
      case 'GESTIONADAS': this.filteredAlerts = this.alerts.filter(a => a.estado === 'GESTIONADA'); break;
      case 'EMAIL':       this.filteredAlerts = this.alerts.filter(a => a.emailEnviado); break;
      default:            this.filteredAlerts = [...this.alerts];
    }
  }

  marcarGestionada(alert: Alert): void {
    this.alertService.update(alert.idAlert, { ...alert, estado: 'GESTIONADA' }).subscribe({
      next: () => this.loadAlerts()
    });
  }

  emptyPedido(): PedidoModal {
    return {
      alerta: { idAlert:0, resultado:'', descripcion:'', fecha:'',
        estado:'PENDIENTE', stockActual:0, stockMinimo:0, emailEnviado:false },
      supplierEmail: '', supplierName: '', cantidad: 1, observaciones: ''
    };
  }

  abrirPedido(alert: Alert): void {
    this.pedido = {
      alerta:        alert,
      supplierEmail: '',
      supplierName:  '',
      cantidad:      alert.stockMinimo ? alert.stockMinimo * 2 : 10,
      observaciones: ''
    };
    this.showPedidoModal = true;
  }

  cerrarPedido(): void {
    this.showPedidoModal = false;
    this.pedido = this.emptyPedido();
  }

  enviarPedido(): void {
    if (!this.pedido.supplierEmail || !this.pedido.cantidad) return;
    this.enviandoPedido = true;
    const user = this.getUserFromStorage();
    const body = {
      alertId:        this.pedido.alerta.idAlert,
      supplierEmail:  this.pedido.supplierEmail,
      supplierName:   this.pedido.supplierName,
      productoNombre: this.pedido.alerta.product?.articulo ?? 'Producto',
      cantidadPedida: this.pedido.cantidad,
      observaciones:  this.pedido.observaciones,
      solicitadoPor:  user
    };
    this.alertService.orderSupplier(body).subscribe({
      next: () => { this.enviandoPedido = false; this.cerrarPedido(); this.loadAlerts(); this.showToast('✅ Pedido enviado'); },
      error: (err: any) => { this.enviandoPedido = false; this.showToast('❌ Error: ' + (err?.error?.message || 'Verifica el email'), true); }
    });
  }

  private getUserFromStorage(): string {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}');
      if (u?.profile) return `${u.profile.name ?? ''} ${u.profile.lastName ?? ''}`.trim();
      return u?.email ?? 'Sistema';
    } catch { return 'Sistema'; }
  }

  toastMsg = ''; toastError = false; toastVisible = false;
  private toastTimer: any;
  showToast(msg: string, error = false): void {
    clearTimeout(this.toastTimer);
    this.toastMsg = msg; this.toastError = error; this.toastVisible = true;
    this.toastTimer = setTimeout(() => this.toastVisible = false, 4000);
  }

  getStockPorcentaje(alert: Alert): number {
    if (!alert.stockMinimo) return 100;
    return Math.min(100, Math.round((alert.stockActual / alert.stockMinimo) * 100));
  }
  getBarraColor(alert: Alert): string {
    const p = this.getStockPorcentaje(alert);
    return p === 0 ? '#dc2626' : p <= 50 ? '#f59e0b' : '#10b981';
  }
  getIconoProducto(cat: string): string {
    const m: Record<string,string> = { 'Router':'📡','Cable':'🔌','ONU':'📶','Herramienta':'🔧','Switch':'🖧','Fibra':'💡','Conector':'🔗' };
    return m[cat] || '📦';
  }
}
