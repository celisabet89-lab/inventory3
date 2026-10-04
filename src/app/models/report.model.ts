export interface ReportFilter {
  startDate?: Date | string;
  endDate?: Date | string;
  productId?: number;
  categoria?: string;
  tipo?: 'ENTRADA' | 'SALIDA';
  userId?: number;
}

export interface InventoryReport {
  producto: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  valorUnitario: number;
  valorTotal: number;
  estado: 'OK' | 'BAJO' | 'CRÍTICO';
}

export interface MovementsReport {
  fecha: Date | string;
  producto: string;
  tipo: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  responsable: string;
  observaciones?: string;
}
