import {User} from './user.model';
import {Client} from './client.model';
import {Product} from './product.model';

export interface Delivery {
  idDelivery?: number;
  fecha: Date | string;
  observacion: string;
  user?: {
    idUser?: number;
    email?: string;
  };
  cliente: {
    idCliente: number;
    nombre: string;
    apellido: string;
  };
  detalles?: DeliveryDetails[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryDetails {
  idDeliveryDetails?: number;
  cantidad: number;
  delivery?: Delivery;
  product: {
    idProducto: number;
    articulo: string;
    descripcion?: string;
  };
}

export interface DeliveryRequest {
  fecha?: Date | string;
  observacion?: string;
  userId?: number;
  clienteId: number;
  details: DeliveryDetailRequest[];
}

export interface DeliveryDetailRequest {
  cantidad: number;
  productId: number;
}
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class DeliveryDetailsRequest {
}
