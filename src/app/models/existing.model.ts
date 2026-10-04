import {Product} from './product.model';

export interface Existing {
  idExisting?: number;
  stockACtual: number;
  stockMinimo: number;
  product: Product;
}

export interface ExistingWithAlert extends Existing {
  alertLevel: 'success' | 'warning' | 'danger';
  percentageRemaining: number;
}
