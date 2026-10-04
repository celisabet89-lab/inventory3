// features/reports/report-dashboard/report-dashboard.component.ts
import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {ReportsService} from '../services/report.service';
import Chart from 'chart.js/auto';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-report-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './report-dashboard.component.html',
  styleUrls: ['./report-dashboard.component.css']
})
export class ReportDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private reportService = inject(ReportsService);
  private router = inject(Router);

  // Referencias a los gráficos
  @ViewChild('salesChart') salesChartRef!: ElementRef;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef;

  // Gráficos
  private salesChart: Chart | null = null;
  private categoryChart: Chart | null = null;

  // Señales para datos
  totalSales = signal(0);
  totalMovements = signal(0);
  lowStockItems = signal(0);
  topProduct = signal<any>({});
  topProducts = signal<any[]>([]);
  recentMovements = signal<any[]>([]);
  inventoryMetrics = signal<any>({});
  recentAlerts = signal<any[]>([]);
  currentMonth = signal(new Date());
  monthlySummary = signal<any>({});

  // Señales para cambios porcentuales
  salesChange = signal(0);
  movementsChange = signal(0);
  lowStockChange = signal(0);

  // Filtros
  selectedPeriod = 'month';
  categoryFilter = 'value';

  // Utilidad para Math
  Math = Math;

  constructor() {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Los gráficos se inicializan después de cargar los datos
    setTimeout(() => {
      this.initializeCharts();
    }, 100);
  }

  ngOnDestroy(): void {
    // Destruir gráficos para evitar fugas de memoria
    if (this.salesChart) {
      this.salesChart.destroy();
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }
  }

  loadDashboardData(): void {
    // Cargar datos principales
    // @ts-ignore
    this.reportService.getSalesSummary(this.selectedPeriod).subscribe({
      next: (data: { total: any; change: any; }) => {
        this.totalSales.set(data.total || 0);
        this.salesChange.set(data.change || 0);
      }
    });

    // @ts-ignore
    this.reportService.getMovementsSummary(this.selectedPeriod).subscribe({
      next: (data: { total: any; change: any; }) => {
        this.totalMovements.set(data.total || 0);
        this.movementsChange.set(data.change || 0);
      }
    });

    // @ts-ignore
    this.reportService.getLowStockReport().subscribe({
      next: (data: { count: any; change: any; }) => {
        this.lowStockItems.set(data.count || 0);
        this.lowStockChange.set(data.change || 0);
      }
    });
// @ts-ignore
    this.reportService.getTopProducts(10).subscribe({
      next: (data: string | any[]) => {
        // @ts-ignore
        this.topProducts.set(data);
        if (data.length > 0) {
          this.topProduct.set(data[0]);
        }
      }
    });

    // @ts-ignore
    this.reportService.getRecentMovements(5).subscribe({
      next: (data: any[]) => {
        this.recentMovements.set(data);
      }
    });

    // @ts-ignore
    this.reportService.getInventoryMetrics().subscribe({
      next: (data: any) => {
        this.inventoryMetrics.set(data);
      }
    });

    // @ts-ignore
    this.reportService.getRecentAlerts(5).subscribe({
      next: (data: any) => {
        this.recentAlerts.set(data);
      }
    });

    // @ts-ignore
    this.reportService.getMonthlySummary(this.currentMonth()).subscribe({
      next: (data: any) => {
        this.monthlySummary.set(data);
      }
    });

    // Actualizar gráficos después de cargar datos
    setTimeout(() => {
      this.updateCharts();
    }, 500);
  }

  initializeCharts(): void {
    // Inicializar gráfico de ventas vs movimientos
    if (this.salesChartRef?.nativeElement) {
      this.salesChart = new Chart(this.salesChartRef.nativeElement, {
        type: 'line',
        data: {
          labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
          datasets: [
            {
              label: 'Ventas',
              data: [1200, 1900, 3000, 5000, 2000, 3000, 4500],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4
            },
            {
              label: 'Movimientos',
              data: [15, 20, 25, 30, 22, 18, 28],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              },
              ticks: {
                callback: function(value) {
                  // @ts-ignore
                  return value >= 1000 ? (value / 1000) + 'k' : value;
                }
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }

    // Inicializar gráfico de categorías
    if (this.categoryChartRef?.nativeElement) {
      this.categoryChart = new Chart(this.categoryChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Redes', 'Cables', 'Fibra Óptica', 'Wireless', 'Accesorios'],
          datasets: [{
            data: [35, 25, 20, 15, 5],
            backgroundColor: [
              '#3b82f6',
              '#10b981',
              '#8b5cf6',
              '#f59e0b',
              '#ef4444'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            }
          },
          cutout: '70%'
        }
      });
    }
  }

  updateCharts(): void {
    // Aquí actualizarías los gráficos con datos reales del servicio
    // Por ahora, usamos datos de prueba
  }

  onPeriodChange(): void {
    this.loadDashboardData();
  }

  updateCategoryChart(): void {
    if (this.categoryChart) {
      // Actualizar datos del gráfico según el filtro seleccionado
      const newData = this.getCategoryChartData();
      this.categoryChart.data.datasets[0].data = newData;
      this.categoryChart.update();
    }
  }

  getCategoryChartData(): number[] {
    // Datos de ejemplo según el filtro
    switch (this.categoryFilter) {
      case 'value':
        return [45000, 32000, 28000, 19000, 8000];
      case 'quantity':
        return [150, 200, 80, 45, 120];
      case 'movements':
        return [45, 60, 25, 15, 20];
      default:
        return [35, 25, 20, 15, 5];
    }
  }

  refreshData(): void {
    this.loadDashboardData();
    Swal.fire({
      icon: 'success',
      title: 'Datos actualizados',
      text: 'El dashboard se ha actualizado correctamente',
      timer: 1500,
      showConfirmButton: false
    });
  }

  exportDashboard(): void {
    Swal.fire({
      title: 'Exportar Reporte',
      html: `
        <div style="text-align: left; padding: 20px;">
          <p>Selecciona el formato de exportación:</p>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
            <label>
              <input type="radio" name="format" value="pdf" checked> PDF (Recomendado)
            </label>
            <label>
              <input type="radio" name="format" value="excel"> Excel
            </label>
            <label>
              <input type="radio" name="format" value="csv"> CSV
            </label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Exportar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const format = (document.querySelector('input[name="format"]:checked') as HTMLInputElement)?.value;
        return format;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        // @ts-ignore
        this.reportService.exportReport(result.value, this.selectedPeriod).subscribe({
          next: ({response}: { response: any }) => {
            Swal.fire({
              icon: 'success',
              title: 'Exportación completada',
              text: `El reporte se ha exportado en formato ${result.value.toUpperCase()}`,
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error: any) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo exportar el reporte'
            });
          }
        });
      }
    });
  }

  viewAllProducts(): void {
    this.router.navigate(['/products']);
  }

  viewAllMovements(): void {
    this.router.navigate(['/stock/movements']);
  }

  handleAlert(alert: any): void {
    Swal.fire({
      title: alert.title,
      text: alert.description || 'Sin descripción adicional',
      icon: alert.level === 'high' ? 'error' : alert.level === 'medium' ? 'warning' : 'info',
      showCancelButton: alert.level === 'high',
      confirmButtonText: alert.level === 'high' ? 'Resolver' : 'OK',
      cancelButtonText: 'Ignorar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Marcar alerta como resuelta
        // @ts-ignore
        this.reportService.resolveAlert(alert.id).subscribe({
          next: () => {
            // Actualizar lista de alertas
            this.recentAlerts.update(alerts => alerts.filter(a => a.id !== alert.id));
          }
        });
      }
    });
  }

  previousMonth(): void {
    const newDate = new Date(this.currentMonth());
    newDate.setMonth(newDate.getMonth() - 1);
    this.currentMonth.set(newDate);
    this.loadMonthlySummary();
  }

  nextMonth(): void {
    const newDate = new Date(this.currentMonth());
    newDate.setMonth(newDate.getMonth() + 1);
    this.currentMonth.set(newDate);
    this.loadMonthlySummary();
  }

  loadMonthlySummary(): void {
    // @ts-ignore
    this.reportService.getMonthlySummary(this.currentMonth()).subscribe({
      next: (data: any) => {
        this.monthlySummary.set(data);
      }
    });
  }

  formatDateShort(dateString: string): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'Hoy';
      } else if (diffDays === 1) {
        return 'Ayer';
      } else if (diffDays <= 7) {
        return `Hace ${diffDays} días`;
      } else {
        return date.toLocaleDateString('es-BO', {
          day: '2-digit',
          month: 'short'
        });
      }
    } catch {
      return 'Fecha inválida';
    }
  }

  formatTimeAgo(timestamp: string): string {
    if (!timestamp) return 'N/A';

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) {
        return 'Hace unos segundos';
      } else if (diffMin < 60) {
        return `Hace ${diffMin} min`;
      } else if (diffHour < 24) {
        return `Hace ${diffHour} h`;
      } else if (diffDay === 1) {
        return 'Ayer';
      } else if (diffDay <= 7) {
        return `Hace ${diffDay} días`;
      } else {
        return date.toLocaleDateString('es-BO', {
          day: 'numeric',
          month: 'short'
        });
      }
    } catch {
      return 'Fecha inválida';
    }
  }

  getUserInitials(fullName: string): string {
    if (!fullName) return '??';

    return fullName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}
