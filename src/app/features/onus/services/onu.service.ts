import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Onu } from '../../../models/onu.model';

export interface OnuRequest {
  marca: string;
  modelo: string;
  serial: string;
  mac: string;
  observaciones?: string;
  estado: 'Disponible' | 'Asignada' | 'En Reparación';
  contrato?: number;
  codigoQR?: string;
  clienteId?: number;
  productId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OnuService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/onu`;

  getAll(): Observable<Onu[]> {
    return this.http.get<Onu[]>(this.apiUrl);
  }

  getById(id: number): Observable<Onu> {
    return this.http.get<Onu>(`${this.apiUrl}/${id}`);
  }

  create(onu: OnuRequest): Observable<Onu> {
    return this.http.post<Onu>(this.apiUrl, onu);
  }

  update(id: number, onu: OnuRequest): Observable<Onu> {
    return this.http.put<Onu>(`${this.apiUrl}/${id}`, onu);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Generar código QR único para ONU
  generateQRCode(serial: string): string {
    const timestamp = new Date().getTime();
    return `ONU-${serial}-${timestamp}`;
  }

  // Filtrar ONUs por estado
  getByEstado(estado: string): Observable<Onu[]> {
    return this.http.get<Onu[]>(`${this.apiUrl}?estado=${estado}`);
  }

  // Obtener estadísticas de ONUs
  getStats(): Observable<{
    total: number;
    disponibles: number;
    asignadas: number;
    enReparacion: number;
  }> {
    // En producción, esto vendría del backend
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }
}
