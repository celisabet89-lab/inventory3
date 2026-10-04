import {Product} from './product.model';

export interface Onu {
  client: any;
  id?: number;
  marca: string;
  modelo: string;
  serial: string;
  mac: string;
  observaciones?: string;
  estado: 'Disponible' | 'Asignada' | 'Mantenimiento' | 'Instalado' | 'Observado' | 'Recogido' |'Defectuoso';
  contrato?: number;
  codigoQR?: string;
  tipoPortador: string
  portador: string;
  product?: Product;
}

export interface OnuRequest {
  marca: string;
  modelo: string;
  serial: string;
  mac: string;
  observaciones?: string;
  estado: 'Disponible' | 'Asignada' | 'En Reparación';
  contrato?: number;
  codigoQR?: string;
  clienteId?: number;
  productId?: number;
}
