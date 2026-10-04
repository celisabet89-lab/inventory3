// models/proveedor.model.ts
export interface Proveedor {
  idProveedor?: number;
  empresa: string;
  pais: string;
  contacto: string;
  email: string;
  direccion: string;
  estado: 'ACTIVO' | 'INACTIVO';
  observaciones?: string;
  fechaRegistro?: Date;
  profileId?: number;
}

export interface ProveedorRequest {
  empresa: string;
  pais: string;
  contacto: string;
  email: string;
  direccion: string;
  estado?: 'ACTIVO' | 'INACTIVO';
  observaciones?: string;
  profileId?: number;
}
