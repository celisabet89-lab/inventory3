import {Product} from './product.model';
import {Client} from './client.model';
import {Onu} from './onu.model';

export interface Alert {
  idAlert?: number;
  resultado?: string;
  descripcion: string;
  fecha: Date | string;
  estado?: 'PENDIENTE' | 'GESTIONADA';
  stockActual?: number;
  stockMinimo?: number;
  product?: Product;
  cliente?: Client;
  onu?: Onu;
}

export interface AlertRequest {
  resultado?: string;
  descripcion: string;
  fecha?: Date | string;
  estado?: 'PENDIENTE' | 'GESTIONADA';
  stockActual?: number;
  stockMinimo?: number;
  productId?: number;
  clienteId?: number;
  onuId?: number;
}
