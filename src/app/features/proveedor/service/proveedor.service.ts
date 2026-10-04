import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Proveedor, ProveedorRequest } from '../../../models/proveedor.model';

@Injectable({
  providedIn: 'root'
})
export class ProveedorService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/proveedor`;

  getAll(): Observable<Proveedor[]> {
    console.log('📡 Llamando a:', this.apiUrl);
    return this.http.get<Proveedor[]>(this.apiUrl);
  }

  getById(id: number): Observable<Proveedor> {
    return this.http.get<Proveedor>(`${this.apiUrl}/${id}`);
  }

  search(term: string): Observable<Proveedor[]> {
    let params = new HttpParams();
    if (term) {
      params = params.set('term', term);
    }
    return this.http.get<Proveedor[]>(`${this.apiUrl}/search`, { params });
  }

  getByEstado(estado: string): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(`${this.apiUrl}/estado/${estado}`);
  }

  getByPais(pais: string): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(`${this.apiUrl}/pais/${pais}`);
  }

  getByEmpresa(empresa: string): Observable<Proveedor> {
    return this.http.get<Proveedor>(`${this.apiUrl}/empresa/${empresa}`);
  }

  create(data: ProveedorRequest): Observable<Proveedor> {
    return this.http.post<Proveedor>(this.apiUrl, data);
  }

  update(id: number, data: ProveedorRequest): Observable<Proveedor> {
    return this.http.put<Proveedor>(`${this.apiUrl}/${id}`, data);
  }

  changeStatus(id: number, estado: 'ACTIVO' | 'INACTIVO'): Observable<Proveedor> {
    return this.http.patch<Proveedor>(`${this.apiUrl}/${id}/estado`, { estado });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
