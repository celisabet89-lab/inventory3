import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AsignacionMaterial {
  id: number;
  fecha: string;
  tecnicoId: number;
  tecnicoNombre: string;
  producto: { idProducto: number; articulo: string; foto?: string; unidadMedida?: { nombre?: string } } | null;
  cantidad: number;
  cantidadUsada: number;
  cantidadDevuelta: number;
  pendiente: number;
  estado: 'ASIGNADO' | 'PARCIAL' | 'CERRADO';
  destino?: string;
  asignadoPor?: string;
  cargoAsignador?: string;
  fechaCierre?: string;
  fechaConfirmacion?: string;
  confirmadoPor?: string;
  bitacora?: string;
}

export interface NuevaAsignacion {
  tecnicoId: number;
  tecnicoNombre: string;
  productoId: number;
  cantidad: number;
  destino?: string;
  asignadoPor?: string;
  cargoAsignador?: string;
}

@Injectable({ providedIn: 'root' })
export class MaterialTecnicoService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/materiales-tecnico`;

  getAll(tecnicoId?: number): Observable<AsignacionMaterial[]> {
    let params = new HttpParams();
    if (tecnicoId) params = params.set('tecnicoId', tecnicoId);
    return this.http.get<AsignacionMaterial[]>(this.api, { params });
  }
  asignar(d: NuevaAsignacion): Observable<AsignacionMaterial> { return this.http.post<AsignacionMaterial>(this.api, d); }
  confirmar(id: number, confirmadoPor: string): Observable<AsignacionMaterial> {
    return this.http.put<AsignacionMaterial>(`${this.api}/${id}/confirmar`, { confirmadoPor });
  }
  registrarUso(id: number, cantidad: number, detalle: string): Observable<AsignacionMaterial> {
    return this.http.put<AsignacionMaterial>(`${this.api}/${id}/uso`, { cantidad, detalle });
  }
  devolver(id: number, cantidad: number, detalle: string): Observable<AsignacionMaterial> {
    return this.http.put<AsignacionMaterial>(`${this.api}/${id}/devolver`, { cantidad, detalle });
  }
  anular(id: number): Observable<void> { return this.http.delete<void>(`${this.api}/${id}`); }
}
