import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TipoClienteOnu {
  id?: number;
  nombre: string;
  descripcion?: string;
  color?: string;
}

export interface ClienteOnu {
  id?: number;
  nombre: string;
  ci?: string;
  celular?: string;
  direccion?: string;
  ubicacion?: string;
  fechaNacimiento?: string | null;
  numeroContrato?: number | null;
  tipoCliente?: { id: number } | TipoClienteOnu | null;
}

@Injectable({ providedIn: 'root' })
export class ClienteOnuService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/cliente-onu`;

  getAll(): Observable<ClienteOnu[]> { return this.http.get<ClienteOnu[]>(this.api); }
  create(d: ClienteOnu): Observable<ClienteOnu> { return this.http.post<ClienteOnu>(this.api, d); }
  update(id: number, d: ClienteOnu): Observable<ClienteOnu> { return this.http.put<ClienteOnu>(`${this.api}/${id}`, d); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.api}/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class TipoClienteOnuService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/tipo-cliente-onu`;

  getAll(): Observable<TipoClienteOnu[]> { return this.http.get<TipoClienteOnu[]>(this.api); }
  create(d: TipoClienteOnu): Observable<TipoClienteOnu> { return this.http.post<TipoClienteOnu>(this.api, d); }
  update(id: number, d: TipoClienteOnu): Observable<TipoClienteOnu> { return this.http.put<TipoClienteOnu>(`${this.api}/${id}`, d); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.api}/${id}`); }
}
