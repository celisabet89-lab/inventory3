import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MovementsService {

  private http = inject(HttpClient);

  private apiUrl =
    `${environment.apiUrl}/movements`;

  getAll(
    tipo: string = '',
    search: string = ''
  ): Observable<any[]> {

    return this.http.get<any[]>(
      this.apiUrl
    );
  }

  getById(
    id: number
  ): Observable<any> {

    return this.http.get<any>(
      `${this.apiUrl}/${id}`
    );
  }

  create(
    movimiento: any
  ): Observable<any> {

    return this.http.post<any>(
      this.apiUrl,
      movimiento
    );
  }

  update(
    id: number,
    movimiento: any
  ): Observable<any> {

    return this.http.put<any>(
      `${this.apiUrl}/${id}`,
      movimiento
    );
  }

  anular(
    id: number
  ): Observable<any> {

    return this.http.patch<any>(
      `${this.apiUrl}/${id}/anular`,
      {}
    );
  }

  delete(
    id: number
  ): Observable<void> {

    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }
}
