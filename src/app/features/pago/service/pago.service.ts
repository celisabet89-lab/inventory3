import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Pago {
  idPago?: number;
  codigoCompra: string;
  monto: number;
  fecha?: string;
  formaPago: string;
  observaciones?: string;
  proveedorNombre?: string;
  estado?: 'ACTIVO' | 'ANULADO';
  motivoAnulacion?: string;
  fechaAnulacion?: string;
}

export interface PagoRequest {
  codigoCompra: string;
  monto: number;
  formaPago: string;
  observaciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pagos`;

  getAll(): Observable<Pago[]> {
    return this.http.get<Pago[]>(this.apiUrl);
  }

  getById(id: number): Observable<Pago> {
    return this.http.get<Pago>(`${this.apiUrl}/${id}`);
  }

  getByCodigoCompra(codigo: string): Observable<Pago[]> {
    return this.http.get<Pago[]>(
      `${this.apiUrl}/compra/${encodeURIComponent(codigo)}`
    );
  }

  create(request: PagoRequest): Observable<Pago> {
    return this.http.post<Pago>(this.apiUrl, request);
  }

  anular(id: number, motivo?: string): Observable<Pago> {
    return this.http.patch<Pago>(`${this.apiUrl}/${id}/anular`, { motivo });
  }
}
