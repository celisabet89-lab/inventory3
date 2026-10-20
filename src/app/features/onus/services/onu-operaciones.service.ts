import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface OnuMovimiento {
  id: number;
  /** ASIGNACION | RECOJO | DIAGNOSTICO */
  tipo: string;
  fecha: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  usuario?: string;
  almacen?: string;
  detalle?: string;
}

export interface OnuItemOperacion {
  onuId: number;
  observaciones?: string;
}

export interface LoteRequest {
  fecha?: string;
  usuario: string;
  observaciones?: string;
  items: OnuItemOperacion[];
}

export interface DiagnosticoRequest {
  fecha?: string;
  onuId: number;
  estadoNuevo: 'Disponible' | 'Defectuoso' | 'Observado' | 'Mantenimiento';
  diagnostico: string;
  almacen?: string;
}

@Injectable({ providedIn: 'root' })
export class OnuOperacionesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/onu-operaciones`;

  asignar(body: LoteRequest): Observable<OnuMovimiento[]> {
    return this.http.post<OnuMovimiento[]>(`${this.apiUrl}/asignar`, body);
  }

  recojo(body: LoteRequest): Observable<OnuMovimiento[]> {
    return this.http.post<OnuMovimiento[]>(`${this.apiUrl}/recojo`, body);
  }

  diagnosticar(body: DiagnosticoRequest): Observable<OnuMovimiento> {
    return this.http.post<OnuMovimiento>(`${this.apiUrl}/diagnostico`, body);
  }

  movimientosDe(onuId: number): Observable<OnuMovimiento[]> {
    return this.http.get<OnuMovimiento[]>(`${this.apiUrl}/movimientos/onu/${onuId}`);
  }
}

/** Mensaje legible de un error HTTP del backend. */
export function mensajeError(err: any, porDefecto = 'No se pudo completar la operación'): string {
  return err?.error?.message || porDefecto;
}

export function hoyISO(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

export function nombreUsuario(u: any): string {
  const nombre = [u?.profile?.name, u?.profile?.lastName].filter(Boolean).join(' ').trim();
  return nombre || u?.name || u?.email || 'Sin nombre';
}

export function nombreCliente(onu: any): string {
  const c = onu?.cliente ?? onu?.client;
  if (c) return [c.nombre ?? c.name, c.apellido].filter(Boolean).join(' ').trim();
  return onu?.tipoPortador === 'Cliente' ? onu?.portador ?? '' : '';
}
