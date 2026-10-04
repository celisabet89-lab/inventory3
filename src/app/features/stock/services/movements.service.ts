import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MovementsService {
  getVentas() {
      throw new Error('Method not implemented.');
  }
  getCompras() {
      throw new Error('Method not implemented.');
  }
  private http   = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/movements`;

  getAll(searchTerm: string = '', typeFilter: string = ''): Observable<any[]> {
    let params = new HttpParams();
    if (searchTerm)  params = params.set('searchTerm', searchTerm);
    if (typeFilter)  params = params.set('tipo', typeFilter);
    return this.http.get<any[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
