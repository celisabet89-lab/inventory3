import {
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AlertService } from '../services/alert.service';

interface Alert {
  idAlert: number;
  resultado: string;
  descripcion: string;
  fecha: string;
  estado: 'PENDIENTE' | 'GESTIONADA';
  stockActual: number;
  stockMinimo: number;
  product?: {
    idProducto: number;
    articulo: string;
    categoria?: {
      idCategoria?: number;
      nombre: string;
    } | null;
    foto?: string;
  };
}

interface PedidoModal {
  alerta: Alert;
  supplierPhone: string;
  supplierName: string;
  cantidad: number;
  observaciones: string;
}

@Component({
  selector: 'app-alert-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './alert-panel.component.html',
  styleUrls: ['./alert-panel.component.css']
})
export class AlertPanelComponent implements OnInit, OnDestroy {

  alerts: Alert[] = [];
  filteredAlerts: Alert[] = [];

  filtroActivo = 'TODAS';
  searchTerm = '';

  cargando = false;
  verificando = false;

  private intervalId: any;

  showPedidoModal = false;

  pedido: PedidoModal = this.emptyPedido();

  constructor(
    private alertService: AlertService
  ) {}

  get totalAlertas(): number {
    return this.alerts.length;
  }

  get pendientes(): number {
    return this.alerts.filter(
      alert => alert.estado === 'PENDIENTE'
    ).length;
  }

  get criticas(): number {
    return this.alerts.filter(
      alert =>
        String(alert.resultado)
          .trim()
          .toUpperCase() === 'CRÍTICO'
    ).length;
  }

  get gestionadas(): number {
    return this.alerts.filter(
      alert => alert.estado === 'GESTIONADA'
    ).length;
  }

  ngOnInit(): void {
    this.loadAlerts();
    this.checkStock();

    this.intervalId = setInterval(
      () => this.checkStock(),
      60000
    );
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  loadAlerts(): void {
    this.cargando = true;

    this.alertService.getAll().subscribe({
      next: (data: Alert[]) => {
        this.alerts = Array.isArray(data)
          ? [...data].sort(
            (a, b) => this.compararAlertas(a, b)
          )
          : [];

        this.aplicarFiltro(this.filtroActivo);
        this.cargando = false;
      },
      error: (err: any) => {
        this.cargando = false;

        console.error('Error cargando alertas:', err);

        this.mostrarError(
          'No se pudieron cargar las alertas.'
        );
      }
    });
  }

  compararAlertas(a: Alert, b: Alert): number {
    if (
      a.estado === 'PENDIENTE' &&
      b.estado !== 'PENDIENTE'
    ) {
      return -1;
    }

    if (
      a.estado !== 'PENDIENTE' &&
      b.estado === 'PENDIENTE'
    ) {
      return 1;
    }

    const criticaA =
      String(a.resultado).trim().toUpperCase() === 'CRÍTICO';

    const criticaB =
      String(b.resultado).trim().toUpperCase() === 'CRÍTICO';

    if (criticaA && !criticaB) {
      return -1;
    }

    if (!criticaA && criticaB) {
      return 1;
    }

    return this.obtenerFecha(b) - this.obtenerFecha(a);
  }

  checkStock(): void {
    if (this.verificando) {
      return;
    }

    this.verificando = true;

    this.alertService.checkStock().subscribe({
      next: () => {
        this.verificando = false;
        this.loadAlerts();
      },
      error: (err: any) => {
        this.verificando = false;

        console.error('Error verificando stock:', err);

        this.mostrarError(
          'No se pudo verificar el stock. Intenta nuevamente.'
        );
      }
    });
  }

  aplicarFiltro(filtro: string): void {
    this.filtroActivo = filtro;

    let resultado = [...this.alerts];

    switch (filtro) {
      case 'PENDIENTES':
        resultado = resultado.filter(
          alert => alert.estado === 'PENDIENTE'
        );
        break;

      case 'CRÍTICAS':
        resultado = resultado.filter(
          alert =>
            String(alert.resultado)
              .trim()
              .toUpperCase() === 'CRÍTICO'
        );
        break;

      case 'GESTIONADAS':
        resultado = resultado.filter(
          alert => alert.estado === 'GESTIONADA'
        );
        break;
    }

    const texto = this.searchTerm.trim().toLowerCase();

    if (texto) {
      resultado = resultado.filter(alert => {
        const contenido = [
          alert.product?.articulo,
          alert.product?.categoria,
          alert.descripcion,
          alert.resultado,
          alert.estado,
          alert.stockActual,
          alert.stockMinimo
        ]
          .map(valor => String(valor ?? ''))
          .join(' ')
          .toLowerCase();

        return contenido.includes(texto);
      });
    }

    this.filteredAlerts = resultado;
  }

  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.aplicarFiltro(this.filtroActivo);
  }

  marcarGestionada(alert: Alert): void {
    Swal.fire({
      icon: 'question',
      title: '¿Gestionar alerta?',
      text: `La alerta de "${alert.product?.articulo || 'este producto'}" se marcará como gestionada.`,
      width: '340px',
      padding: '1rem',
      showCancelButton: true,
      confirmButtonText: 'Sí, gestionar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1b6f6f',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      background: '#ffffff',
      color: '#1f2937',
      customClass: {
        popup: 'sin-limite-alert-popup',
        title: 'sin-limite-alert-title',
        htmlContainer: 'sin-limite-alert-text',
        confirmButton: 'sin-limite-alert-confirm',
        cancelButton: 'sin-limite-alert-cancel'
      }
    }).then(result => {
      if (!result.isConfirmed) {
        return;
      }

      this.alertService.update(
        alert.idAlert,
        {
          ...alert,
          estado: 'GESTIONADA'
        }
      ).subscribe({
        next: () => {
          this.loadAlerts();

          this.mostrarToast(
            'Alerta gestionada correctamente.',
            'success'
          );
        },
        error: (err: any) => {
          console.error('Error gestionando alerta:', err);

          this.mostrarError(
            'No se pudo gestionar la alerta.'
          );
        }
      });
    });
  }

  emptyPedido(): PedidoModal {
    return {
      alerta: {
        idAlert: 0,
        resultado: '',
        descripcion: '',
        fecha: '',
        estado: 'PENDIENTE',
        stockActual: 0,
        stockMinimo: 0
      },
      supplierPhone: '',
      supplierName: '',
      cantidad: 1,
      observaciones: ''
    };
  }

  abrirPedido(alert: Alert): void {
    this.pedido = {
      alerta: alert,
      supplierPhone: '',
      supplierName: '',
      cantidad: alert.stockMinimo
        ? alert.stockMinimo * 2
        : 10,
      observaciones: ''
    };

    this.showPedidoModal = true;
  }

  cerrarPedido(): void {
    this.showPedidoModal = false;
    this.pedido = this.emptyPedido();
  }

  abrirWhatsAppPedido(): void {
    const telefono = this.pedido.supplierPhone.replace(/\D/g, '');

    if (!telefono) {
      this.mostrarError(
        'Ingresa el número de celular del proveedor.'
      );
      return;
    }

    const numeroInternacional =
      telefono.length === 8
        ? `591${telefono}`
        : telefono;

    if (
      numeroInternacional.length < 10 ||
      numeroInternacional.length > 15
    ) {
      this.mostrarError(
        'Revisa el número e incluye el código de país si corresponde.'
      );
      return;
    }

    const cantidad = Number(this.pedido.cantidad);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      this.mostrarError(
        'La cantidad solicitada debe ser mayor a cero.'
      );
      return;
    }

    const producto =
      this.pedido.alerta.product?.articulo || 'Producto';

    const proveedor = this.pedido.supplierName.trim();

    const observaciones =
      this.pedido.observaciones.trim() || 'Sin observaciones';

    const mensaje = [
      `Hola${proveedor ? ` ${proveedor}` : ''}, te contactamos de SIN LIMITE para solicitar una reposición de inventario.`,
      '',
      `Producto: ${producto}`,
      `Cantidad solicitada: ${cantidad} unidades`,
      `Solicitado por: ${this.getUserFromStorage()}`,
      `Observaciones: ${observaciones}`,
      '',
      'Por favor, confirma la disponibilidad y el tiempo de entrega. Gracias.'
    ].join('\n');

    const url =
      `https://wa.me/${numeroInternacional}?text=${encodeURIComponent(mensaje)}`;

    const ventana = window.open(url, '_blank');

    if (!ventana) {
      this.mostrarError(
        'No se pudo abrir WhatsApp. Permite las ventanas emergentes del navegador.'
      );
      return;
    }

    ventana.opener = null;

    this.mostrarToast(
      'Mensaje preparado en WhatsApp. Revisa el pedido y pulsa Enviar.',
      'info'
    );
  }

  private getUserFromStorage(): string {
    try {
      const user = JSON.parse(
        localStorage.getItem('user') ?? '{}'
      );

      if (user?.profile) {
        return `${user.profile.name ?? ''} ${user.profile.lastName ?? ''}`.trim();
      }

      return (
        user?.name ||
        user?.nombre ||
        user?.email ||
        'Sistema'
      );
    } catch {
      return 'Sistema';
    }
  }

  esEmailValido(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  getStockPorcentaje(alert: Alert): number {
    if (!alert.stockMinimo || alert.stockMinimo <= 0) {
      return 100;
    }

    return Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (alert.stockActual / alert.stockMinimo) * 100
        )
      )
    );
  }

  getBarraColor(alert: Alert): string {
    if (alert.estado === 'GESTIONADA') {
      return '#1b6f6f';
    }

    const porcentaje = this.getStockPorcentaje(alert);

    if (porcentaje <= 25) {
      return '#dc2626';
    }

    if (porcentaje <= 50) {
      return '#f59e0b';
    }

    return '#10b981';
  }

  getIconoProducto(categoria: string): string {
    const mapa: Record<string, string> = {
      Router: '📡',
      Cable: '🔌',
      ONU: '📶',
      Herramienta: '🔧',
      Switch: '🖧',
      Fibra: '💡',
      Conector: '🔗'
    };

    return mapa[categoria] || '📦';
  }

  getNivelTexto(alert: Alert): string {
    return String(alert.resultado)
      .trim()
      .toUpperCase() === 'CRÍTICO'
      ? 'CRÍTICO'
      : 'STOCK BAJO';
  }

  obtenerFecha(alert: Alert): number {
    if (!alert?.fecha) {
      return 0;
    }

    const tiempo = new Date(alert.fecha).getTime();

    return Number.isFinite(tiempo) ? tiempo : 0;
  }

  mostrarError(mensaje: string): void {
    Swal.fire({
      icon: 'error',
      title: 'No se pudo completar',
      text: mensaje,
      width: '340px',
      padding: '1rem',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#1b6f6f',
      background: '#ffffff',
      color: '#1f2937',
      customClass: {
        popup: 'sin-limite-alert-popup',
        title: 'sin-limite-alert-title',
        htmlContainer: 'sin-limite-alert-text',
        confirmButton: 'sin-limite-alert-confirm'
      }
    });
  }

  mostrarToast(
    mensaje: string,
    tipo: 'success' | 'error' | 'warning' | 'info'
  ): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: tipo,
      title: mensaje,
      showConfirmButton: false,
      timer: 2800,
      timerProgressBar: true,
      background: '#ffffff',
      color: '#1f2937'
    });
  }
}
