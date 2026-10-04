export interface Product {
  unidadMedida: any;
  stock: string;
  idProducto?: number;
  articulo: string;
  descripcion?: string;
  unidad?: number;
  foto?: string;
  precio?: number;
  categoria?: string;
  codigoBarras?: string;
  codigoQR?: string;
  activo?: boolean;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

export interface ProductForm {
  articulo: string;
  descripcion?: string;
  unidadMEdida?: number;
  foto?: File | string;
  precio?: number;
  categoria?: string;
  codigoBarras?: string;
  codigoQR?: string;
  activo?: boolean;
}

export interface ProductFilter {
  search?: string;
  categoria?: string;
  activo?: boolean;
  page?: number;
  limit?: number;
}

export interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
