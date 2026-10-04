export interface DashboardStats {
  totalProductos: number;
  stockCritico: number;
  movimientosHoy: number;
  onusDisponibles: number;
  alertasPendientes: number;
  valorTotalInventario: number;
}

export interface ProductoMasUsado {
  producto: string;
  cantidad: number;
  categoria: string;
}

export interface MovimientoReciente {
  fecha: Date | string;
  producto: string;
  cantidad: number;
  tipo: 'ENTRADA' | 'SALIDA';
  responsable: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}
