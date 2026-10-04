import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// FIX: categoria y unidadMedida son IDs (Long) no strings
export interface ProductRequest {
  articulo:      string;
  descripcion?:  string;
  unidad?:       number;
  foto?:         string;
  precio?:       number;
  codigoBarras?: string;
  categoria?:    number;
  unidadMedida?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private api = `${environment.apiUrl}/product`;
  constructor(private http: HttpClient) {}
  getAll():                                Observable<any[]> { return this.http.get<any[]>(this.api); }
  getById(id: number):                     Observable<any>   { return this.http.get<any>(`${this.api}/${id}`); }
  create(data: ProductRequest):            Observable<any>   { return this.http.post<any>(this.api, data); }
  update(id: number, data: ProductRequest): Observable<any>  { return this.http.put<any>(`${this.api}/${id}`, data); }
  delete(id: number):                      Observable<void>  { return this.http.delete<void>(`${this.api}/${id}`); }
}
