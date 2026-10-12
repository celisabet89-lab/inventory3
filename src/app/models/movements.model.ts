// src/app/models/movements.model.ts

export interface MovementUser {
  id?: number;
  idUser?: number;
  userId?: number;
  name?: string;
  lastName?: string;
  email?: string;
  password?: string;
  profile?: {
    id?: number;
    name?: string;
    lastName?: string;
    cargo?: string;
  };
  rol?: {
    id?: number;
    nombre?: string;
    cargo?: string;
  };
}

export interface MovementProduct {
  idProducto?: number;
  articulo?: string;
  descripcion?: string;
  codigoBarras?: string;
  codigoQR?: string;
  foto?: string;
  unidad?: number;
  precio?: number;
}

export interface Movements {
  id?: number;
  idMovements?: number;

  fecha: Date | string;

  // Producto
  productoId?: number;
  idProducto?: number;

  producto?: MovementProduct;
  product?: MovementProduct;

  cantidad: number;

  tipo: 'ENTRADA' | 'SALIDA' | 'entrada' | 'salida';

  responsable?: string;
  observaciones?: string;


  codigo?: string;

  formaPago?: string;
  estadoPago?: string;


  total?: number;

  userId?: number;
  usuario?: number;

  user?: MovementUser;
}
