import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BaseService<T> {
  protected http = inject(HttpClient);
  protected apiUrl: string;

  constructor(protected endpoint: string) {
    this.apiUrl = `${environment.apiUrl}/${endpoint}`;
  }

  getAll(): Observable<T[]> {
    return this.http.get<T[]>(this.apiUrl);
  }

  getById(id: number): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${id}`);
  }

  create(data: any): Observable<T> {
    return this.http.post<T>(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Métodos útiles adicionales
  search(params: HttpParams): Observable<T[]> {
    return this.http.get<T[]>(this.apiUrl, { params });
  }

  count(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/count`);
  }
}
