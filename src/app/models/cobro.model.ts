
export interface Cobro {
  idCobro?: number;
  codigoVenta: string;
  monto: number;
  fecha?: string;
  formaPago: string;
  observaciones?: string;
  clienteNombre?: string;
}

export interface CobroRequest {
  codigoVenta: string;
  monto: number;
  formaPago: string;
  observaciones?: string;
}

export interface VentaPendiente {
  codigoVenta: string;
  clienteNombre: string;
  totalVenta: number;
  totalCobrado: number;
  saldoPendiente: number;
  estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
}
