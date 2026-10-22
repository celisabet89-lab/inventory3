import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface MarcaOnu {
  id?: number;
  nombre: string;
  descripcion?: string;
}

@Injectable({ providedIn: 'root' })
export class MarcaOnuService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/marca-onu`;

  getAll(): Observable<MarcaOnu[]> { return this.http.get<MarcaOnu[]>(this.api); }
  create(d: MarcaOnu): Observable<MarcaOnu> { return this.http.post<MarcaOnu>(this.api, d); }
  update(id: number, d: MarcaOnu): Observable<MarcaOnu> { return this.http.put<MarcaOnu>(`${this.api}/${id}`, d); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.api}/${id}`); }
}
