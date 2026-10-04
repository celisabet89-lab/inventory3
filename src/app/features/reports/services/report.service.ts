import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface InventoryReport {
  totalProductos: number;
  valorTotal: number;
  productosBajoStock: number;
  productosCriticos: number;
  topProductos: Array<{
    nombre: string;
    cantidad: number;
    valor: number;
  }>;
  distribucionPorCategoria: Array<{
    categoria: string;
    cantidad: number;
    porcentaje: number;
  }>;
}

export interface MovementsReport {
  totalMovimientos: number;
  totalEntradas: number;
  totalSalidas: number;
  movimientosPorMes: Array<{
    mes: string;
    entradas: number;
    salidas: number;
  }>;
  productosMasMovidos: Array<{
    producto: string;
    movimientos: number;
  }>;
}

export interface OnuReport {
  totalOnus: number;
  disponibles: number;
  asignadas: number;
  enReparacion: number;
  tasaUtilizacion: number;
  onusPorMarca: Array<{
    marca: string;
    cantidad: number;
  }>;
  clientesConOnu: number;
}

export interface AlertsReport {
  totalAlertas: number;
  alertasPendientes: number;
  alertasCriticas: number;
  tiempoPromedioResolucion: number;
  alertasPorTipo: Array<{
    tipo: string;
    cantidad: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  exportReport(value: any, selectedPeriod: string) {
      throw new Error('Method not implemented.');
  }
  resolveAlert(id: any) {
      throw new Error('Method not implemented.');
  }
  getRecentAlerts(arg0: number) {
      throw new Error('Method not implemented.');
  }
  getInventoryMetrics() {
      throw new Error('Method not implemented.');
  }
  getRecentMovements(arg0: number) {
      throw new Error('Method not implemented.');
  }
  getTopProducts(arg0: number) {
      throw new Error('Method not implemented.');
  }
  getLowStockReport() {
      throw new Error('Method not implemented.');
  }
  getMonthlySummary(arg0: Date) {
      throw new Error('Method not implemented.');
  }
  getMovementsSummary(selectedPeriod: string) {
      throw new Error('Method not implemented.');
  }
  getSalesSummary(selectedPeriod: string) {
      throw new Error('Method not implemented.');
  }
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Reporte de Inventario
  getInventoryReport(fechaInicio?: string, fechaFin?: string): Observable<InventoryReport> {
    const params = fechaInicio && fechaFin
      ? `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      : '';
    return this.http.get<InventoryReport>(`${this.apiUrl}/reports/inventory${params}`);
  }

  // Reporte de Movimientos
  getMovementsReport(fechaInicio?: string, fechaFin?: string): Observable<MovementsReport> {
    const params = fechaInicio && fechaFin
      ? `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      : '';
    return this.http.get<MovementsReport>(`${this.apiUrl}/reports/movements${params}`);
  }

  // Reporte de ONUs
  getOnuReport(): Observable<OnuReport> {
    return this.http.get<OnuReport>(`${this.apiUrl}/reports/onus`);
  }

  // Reporte de Alertas
  getAlertsReport(fechaInicio?: string, fechaFin?: string): Observable<AlertsReport> {
    const params = fechaInicio && fechaFin
      ? `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      : '';
    return this.http.get<AlertsReport>(`${this.apiUrl}/reports/alerts${params}`);
  }

  // Dashboard completo
  getDashboardData(): Observable<{
    inventory: InventoryReport;
    movements: MovementsReport;
    onus: OnuReport;
    alerts: AlertsReport;
  }> {
    return forkJoin({
      inventory: this.getInventoryReport(),
      movements: this.getMovementsReport(),
      onus: this.getOnuReport(),
      alerts: this.getAlertsReport()
    });
  }

  // Exportar reportes a Excel
  exportToExcel(reportType: string, fechaInicio?: string, fechaFin?: string): Observable<Blob> {
    const params = fechaInicio && fechaFin
      ? `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      : '';
    return this.http.get(
      `${this.apiUrl}/reports/export/${reportType}${params}`,
      { responseType: 'blob' }
    );
  }

  // Exportar reporte a PDF
  exportToPDF(reportType: string, fechaInicio?: string, fechaFin?: string): Observable<Blob> {
    const params = fechaInicio && fechaFin
      ? `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      : '';
    return this.http.get(
      `${this.apiUrl}/reports/pdf/${reportType}${params}`,
      { responseType: 'blob' }
    );
  }
}

export class ReportService {
}
