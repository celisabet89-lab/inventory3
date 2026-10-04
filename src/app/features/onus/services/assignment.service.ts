import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Assignment } from '../../../models/assignment.model';

export interface ChecklistItem {
  label: string;
  checked: boolean;
  observacion?: string;
}

export interface AssignmentRequest {
  fecha?: Date | string;
  datos?: string;
  fotosUrls?: string[];
  checklistCompletado?: boolean;
  itemsChecklist?: ChecklistItem[];
  onuId: number;
  clienteId: number;
  userId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AssignmentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/assignment`;

  getAll(): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(this.apiUrl);
  }

  getById(id: number): Observable<Assignment> {
    return this.http.get<Assignment>(`${this.apiUrl}/${id}`);
  }

  create(assignment: AssignmentRequest): Observable<Assignment> {
    return this.http.post<Assignment>(this.apiUrl, assignment);
  }

  update(id: number, assignment: AssignmentRequest): Observable<Assignment> {
    return this.http.put<Assignment>(`${this.apiUrl}/${id}`, assignment);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Obtener asignaciones por técnico
  getByTecnico(userId: number): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(`${this.apiUrl}?userId=${userId}`);
  }

  // Obtener asignaciones por ONU
  getByOnu(onuId: number): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(`${this.apiUrl}?onuId=${onuId}`);
  }

  // Checklist predeterminado para instalación de ONU
  getDefaultChecklist(): ChecklistItem[] {
    return [
      { label: 'ONU recibida en buen estado (sin daños físicos)', checked: false },
      { label: 'Serial y MAC coinciden con la etiqueta', checked: false },
      { label: 'Cables y conectores en perfecto estado', checked: false },
      { label: 'Prueba de encendido exitosa (LED verde)', checked: false },
      { label: 'Señal óptica dentro de parámetros (-28 a -8 dBm)', checked: false },
      { label: 'Configuración de red completada', checked: false },
      { label: 'Prueba de velocidad satisfactoria', checked: false },
      { label: 'Cliente capacitado en uso básico', checked: false },
      { label: 'Documentación entregada al cliente', checked: false },
      { label: 'Área de instalación limpia y ordenada', checked: false }
    ];
  }
}
