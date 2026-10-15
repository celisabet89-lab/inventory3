
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { MovementsService } from '../../stock/services/movements.service';
import { Cobro, CobroService } from '../service/cobro.service';

interface VentaCobro {
  codigoVenta: string;
  clienteNombre: string;
  fecha?: string;
  totalVenta: number;
  totalCobrado: number;
  saldoPendiente: number;
  estadoPago: string;
  formaPago: string;
}

@Component({
  selector: 'app-cobros-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobros-list.component.html',
  styleUrls: ['./cobros-list.component.css']
})
export class CobrosListComponent implements OnInit {
  private movementsService = inject(MovementsService);
  private cobroService = inject(CobroService);

  ventas: VentaCobro[] = [];
  ventasFiltradas: VentaCobro[] = [];
  cobros: Cobro[] = [];

  busqueda = '';
  filtroEstado = 'TODOS';
  cargando = false;
  errorCarga = false;

  mostrarFormulario = false;
  mostrandoHistorial = false;
  ventaSeleccionada: VentaCobro | null = null;

  historial: Cobro[] = [];
  cargandoHistorial = false;

  monto = 0;
  formaPago = 'EFECTIVO';
  observaciones = '';
  guardando = false;

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.errorCarga = false;

    forkJoin({
      movimientos: this.movementsService.getAll('', ''),
      cobros: this.cobroService.getAll()
    }).subscribe({
      next: ({ movimientos, cobros }) => {
        this.cobros = cobros ?? [];
        this.construirVentas(movimientos ?? []);
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.errorCarga = true;

        Swal.fire({
          icon: 'error',
          title: 'No se pudieron cargar los datos',
          text: 'Verifica que el backend esté funcionando e inténtalo de nuevo.',
          confirmButtonColor: '#6d28d9'
        });
      }
    });
  }

  private construirVentas(movimientos: any[]): void {
    const grupos = new Map<string, any[]>();

    movimientos
      .filter(m =>
        String(m.tipo ?? m.tipoMovimiento ?? '').toUpperCase() === 'SALIDA'
      )
      .filter(m =>
        !m.estadoMovimiento ||
        String(m.estadoMovimiento).toUpperCase() === 'ACTIVO'
      )
      .filter(m => !!m.codigo)
      .forEach(m => {
        const codigo = String(m.codigo).trim();
        const grupo = grupos.get(codigo) ?? [];

        grupo.push(m);
        grupos.set(codigo, grupo);
      });

    this.ventas = Array.from(grupos.entries()).map(([codigo, items]) => {
      const totalVenta = items.reduce(
        (total, item) =>
          total + Number(item.total ?? item.subtotal ?? item.liquido ?? 0),
        0
      );

      const cobrosVenta = this.cobros.filter(
        cobro => String(cobro.codigoVenta).trim() === codigo
      );

      const totalCobradoRegistrado = cobrosVenta.reduce(
        (total, cobro) => total + Number(cobro.monto ?? 0),
        0
      );

      const estadoOriginal = String(
        items[0].estadoPago ?? 'PENDIENTE'
      ).trim().toUpperCase();

      // Las ventas marcadas como pagadas al contado
      // no necesitan tener un registro adicional en Cobros.
      const totalCobrado =
        estadoOriginal === 'PAGADO' && totalCobradoRegistrado === 0
          ? totalVenta
          : totalCobradoRegistrado;

      const saldoPendiente = Math.max(
        0,
        totalVenta - totalCobrado
      );

      let estadoPago: string;

      if (saldoPendiente <= 0.01) {
        estadoPago = 'PAGADO';
      } else if (totalCobrado > 0) {
        estadoPago = 'PARCIAL';
      } else {
        // Una venta pendiente sin abonos permanece pendiente.
        estadoPago = 'PENDIENTE';
      }

      return {
        codigoVenta: codigo,
        clienteNombre:
          items[0].responsable ??
          items[0].clienteNombre ??
          'Sin registrar',
        fecha: items[0].fecha,
        totalVenta,
        totalCobrado,
        saldoPendiente,
        estadoPago,
        formaPago: items[0].formaPago ?? 'No especificada'
      };
    });

    this.ventas.sort((a, b) =>
      String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''))
    );

    this.aplicarFiltros();
  }


  aplicarFiltros(): void {
    const texto = this.busqueda.trim().toLowerCase();

    this.ventasFiltradas = this.ventas.filter(venta => {
      const tieneSaldo = venta.saldoPendiente > 0.01;

      const coincideTexto =
        venta.codigoVenta.toLowerCase().includes(texto) ||
        venta.clienteNombre.toLowerCase().includes(texto);

      const coincideEstado =
        this.filtroEstado === 'TODOS' ||
        venta.estadoPago === this.filtroEstado;

      return tieneSaldo && coincideTexto && coincideEstado;
    });
  }


  abrirCobro(venta: VentaCobro): void {
    if (venta.saldoPendiente <= 0.01) {
      Swal.fire({
        icon: 'info',
        title: 'Venta pagada',
        text: 'Esta venta no tiene saldo pendiente.',
        confirmButtonColor: '#6d28d9'
      });
      return;
    }

    this.ventaSeleccionada = venta;
    this.monto = Number(venta.saldoPendiente.toFixed(2));
    this.formaPago = 'EFECTIVO';
    this.observaciones = '';
    this.mostrarFormulario = true;
    this.mostrandoHistorial = false;
  }

  cerrarFormulario(): void {
    if (this.guardando) return;

    this.mostrarFormulario = false;
    this.ventaSeleccionada = null;
  }

  registrarCobro(): void {
    const venta = this.ventaSeleccionada;
    const monto = Number(this.monto);

    if (!venta || !Number.isFinite(monto) || monto <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Monto inválido',
        text: 'Ingresa un monto mayor que cero.',
        confirmButtonColor: '#6d28d9'
      });
      return;
    }

    if (monto > venta.saldoPendiente + 0.01) {
      Swal.fire({
        icon: 'warning',
        title: 'Monto excedido',
        text: `El saldo pendiente es ${this.moneda(venta.saldoPendiente)}.`,
        confirmButtonColor: '#6d28d9'
      });
      return;
    }

    this.guardando = true;

    this.cobroService.create({
      codigoVenta: venta.codigoVenta,
      monto,
      formaPago: this.formaPago,
      observaciones: this.observaciones.trim()
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarFormulario = false;
        this.ventaSeleccionada = null;

        Swal.fire({
          icon: 'success',
          title: '¡Cobro registrado!',
          text: 'El pago se guardó correctamente.',
          timer: 1800,
          showConfirmButton: false
        });

        this.cargarDatos();
      },
      error: (err: any) => {
        this.guardando = false;

        const mensaje = typeof err?.error === 'string'
          ? err.error
          : err?.error?.message ?? 'No se pudo registrar el cobro.';

        Swal.fire({
          icon: 'error',
          title: 'Error al registrar',
          text: mensaje,
          confirmButtonColor: '#6d28d9'
        });
      }
    });
  }

  verHistorial(venta: VentaCobro): void {
    this.ventaSeleccionada = venta;
    this.mostrandoHistorial = true;
    this.mostrarFormulario = false;
    this.historial = [];
    this.cargandoHistorial = true;

    this.cobroService.getByCodigoVenta(venta.codigoVenta).subscribe({
      next: (datos: Cobro[]) => {
        this.historial = datos ?? [];
        this.cargandoHistorial = false;
      },
      error: () => {
        this.historial = [];
        this.cargandoHistorial = false;

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo consultar el historial.',
          confirmButtonColor: '#6d28d9'
        });
      }
    });
  }

  cerrarHistorial(): void {
    this.mostrandoHistorial = false;
    this.ventaSeleccionada = null;
    this.historial = [];
  }

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(Number(valor) || 0);
  }

  fechaFormato(fecha?: string): string {
    if (!fecha) return 'Sin fecha';

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) return fecha;

    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  }

  get totalVentas(): number {
    return this.ventas.reduce(
      (suma, venta) => suma + venta.totalVenta,
      0
    );
  }

  get totalCobrado(): number {
    return this.ventas.reduce(
      (suma, venta) => suma + venta.totalCobrado,
      0
    );
  }

  get totalPendiente(): number {
    return this.ventas.reduce(
      (suma, venta) => suma + venta.saldoPendiente,
      0
    );
  }

  get cantidadPendientes(): number {
    return this.ventas.filter(
      venta => venta.saldoPendiente > 0.01
    ).length;
  }

  get cantidadPagadas(): number {
    return this.ventas.filter(
      venta => venta.estadoPago === 'PAGADO'
    ).length;
  }
}
