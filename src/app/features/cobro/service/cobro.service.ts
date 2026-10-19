import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Cobro {
  idCobro?: number;
  codigoVenta: string;
  monto: number;
  fecha?: string;
  formaPago: string;
  observaciones?: string;
  clienteNombre?: string;
  /** Los cobros antiguos pueden venir sin estado: se consideran ACTIVO. */
  estado?: 'ACTIVO' | 'ANULADO';
  motivoAnulacion?: string;
  fechaAnulacion?: string;
}

export interface CobroRequest {
  codigoVenta: string;
  monto: number;
  formaPago: string;
  observaciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CobroService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/cobros`;

  getAll(): Observable<Cobro[]> {
    return this.http.get<Cobro[]>(this.apiUrl);
  }

  getById(id: number): Observable<Cobro> {
    return this.http.get<Cobro>(`${this.apiUrl}/${id}`);
  }

  getByCodigoVenta(codigo: string): Observable<Cobro[]> {
    return this.http.get<Cobro[]>(
      `${this.apiUrl}/venta/${encodeURIComponent(codigo)}`
    );
  }

  create(request: CobroRequest): Observable<Cobro> {
    return this.http.post<Cobro>(this.apiUrl, request);
  }

  anular(id: number, motivo?: string): Observable<Cobro> {
    return this.http.patch<Cobro>(`${this.apiUrl}/${id}/anular`, { motivo });
  }
}
