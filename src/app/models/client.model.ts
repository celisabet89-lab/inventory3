// models/client.model.ts
export interface Client {
  idCliente?: number;
  nombre: string;
  apellido?: string;
  ci: string;
  celular: string;
  email: string;
  lugarVentaId?: number;
  lugarVenta?: {
    idLugarVenta: number;
    lugarVenta: string;
  };
  telefono?: string;
  estado?: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
  observaciones?: string;
  fechaRegistro?: Date;
}

export interface ClientRequest {
  nombre: string;
  apellido?: string;
  ci: string;
  celular: string;
  email: string;
  lugarVentaId?: number;
  telefono?: string;
  estado?: string;
  observaciones?: string;
}
