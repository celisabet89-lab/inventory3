import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface OnuMovimiento {
  id: number;
  /** REGISTRO | ASIGNACION | RECOJO | DIAGNOSTICO */
  tipo: string;
  fecha: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  usuario?: string;
  /** Cargo de quien realizó la operación. */
  cargo?: string;
  almacen?: string;
  detalle?: string;
}

export interface OnuItemOperacion {
  onuId: number;
  observaciones?: string;
}

export type TipoDestino = 'USUARIO' | 'EMPRESA' | 'CLIENTE';
export type CargoUsuario = 'Técnico' | 'Administrador' | 'Encargado';

export interface LoteRequest {
  fecha?: string;
  /** Solo asignar. Por defecto USUARIO. */
  tipoDestino?: TipoDestino;
  cargo?: CargoUsuario;
  empresa?: string;
  clienteId?: number;
  contrato?: number;
  usuario?: string;
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

/** Deduce el cargo (Técnico, Administrador, Encargado) de un usuario según su cargo o rol. */
export function cargoDe(u: any): CargoUsuario | '' {
  const texto = [u?.profile?.cargo, u?.rol?.cargo, u?.rol?.nombre]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (texto.includes('tecnic')) return 'Técnico';
  if (texto.includes('admin')) return 'Administrador';
  if (texto.includes('encarg')) return 'Encargado';
  return '';
}

export function nombreCliente(onu: any): string {
  const c = onu?.cliente ?? onu?.client;
  if (c) return [c.nombre ?? c.name, c.apellido].filter(Boolean).join(' ').trim();
  return onu?.tipoPortador === 'Cliente' ? onu?.portador ?? '' : '';
}
