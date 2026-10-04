// models/movements.model.ts
export interface Movements {
  id?: number;
  fecha: Date | string;
  productoId: number;
  producto?: {
    idProducto: number;
    articulo: string;
    // otros campos del producto si los necesitas
  };
  cantidad: number;
  tipo: 'entrada' | 'salida';
  observaciones?: string;
}
