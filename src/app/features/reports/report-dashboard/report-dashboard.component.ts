import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Chart } from 'chart.js/auto';
import { ReportsService } from '../services/report.service';
import { ExistingService } from '../../stock/services/existing.service';
import { DatosReporte, comprasDe, mesActual, ventasDe } from '../services/report.builders';
import { esRegistroActivo } from '../../../shared/documento/documento.mode';

interface Kpi { etiqueta: string; valor: number; icono: string; clase: string; }
interface TopProducto { nombre: string; unidades: number; total: number; }
interface StockBajo { nombre: string; actual: number; minimo: number; }

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Component({
  selector: 'app-report-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './report-dashboard.component.html',
  styleUrl: './report-dashboard.component.css'
})
export class ReportDashboardComponent implements AfterViewInit, OnDestroy {
  private reportes = inject(ReportsService);
  private existing = inject(ExistingService);

  @ViewChild('ventasChart') ventasCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoriaChart') categoriaCanvas!: ElementRef<HTMLCanvasElement>;

  kpis: Kpi[] = [];
  topProductos: TopProducto[] = [];
  stockBajo: StockBajo[] = [];
  cargando = true;
  private graficos: Chart[] = [];

  ngAfterViewInit(): void {
    forkJoin({
      datos: this.reportes.cargar(),
      stock: this.existing.getAll().pipe(catchError(() => of([] as any[])))
    }).subscribe(({ datos, stock }) => {
      this.cargando = false;
      this.calcular(datos, stock);
    });
  }

  ngOnDestroy(): void {
    this.graficos.forEach(g => g.destroy());
  }

  private calcular(d: DatosReporte, stock: any[]): void {
    const mes = mesActual();
    const ventas = ventasDe(d);
    const compras = comprasDe(d);
    const suma = (v: number[]) => v.reduce((s, x) => s + x, 0);
    const delMes = (f?: string) => String(f ?? '').slice(0, 7) === mes;

    const cobradoMes =
      suma(d.cobros.filter(c => esRegistroActivo(c) && delMes(c.fecha)).map(c => Number(c.monto) || 0)) +
      suma(ventas.filter(v => delMes(v.fecha) && v.pagado > 0 && !d.cobros.some(c => c.codigoVenta === v.codigo && esRegistroActivo(c))).map(v => v.pagado));

    this.stockBajo = stock
      .filter(e => Number(e.stockACtual) <= Number(e.stockMinimo))
      .map(e => ({ nombre: e.product?.articulo ?? 'Producto', actual: Number(e.stockACtual), minimo: Number(e.stockMinimo) }))
      .sort((a, b) => a.actual - b.actual)
      .slice(0, 8);

    this.kpis = [
      { etiqueta: 'Ventas del mes', valor: suma(ventas.filter(v => delMes(v.fecha)).map(v => v.total)), icono: 'fa-shopping-cart', clase: 'teal' },
      { etiqueta: 'Ingresos del mes', valor: cobradoMes, icono: 'fa-hand-holding-usd', clase: 'green' },
      { etiqueta: 'Por cobrar', valor: suma(ventas.map(v => v.saldo)), icono: 'fa-clock', clase: 'orange' },
      { etiqueta: 'Por pagar', valor: suma(compras.map(c => c.saldo)), icono: 'fa-file-invoice-dollar', clase: 'red' }
    ];

    // Ventas de los últimos 6 meses
    const meses: string[] = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const f = new Date(base.getFullYear(), base.getMonth() - i, 1);
      meses.push(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`);
    }
    const porMes = meses.map(m => suma(ventas.filter(v => String(v.fecha ?? '').slice(0, 7) === m).map(v => v.total)));

    // Top productos y ventas por categoría (movimientos de venta activos)
    const lineas = d.movs.filter(m =>
      String(m.tipo ?? m.tipoMovimiento ?? '').toUpperCase() === 'SALIDA' &&
      (!m.estadoMovimiento || String(m.estadoMovimiento).toUpperCase() === 'ACTIVO')
    );
    const monto = (m: any) => {
      const g = Number(m.total ?? m.subtotal ?? 0);
      return g > 0 ? g : Number(m.cantidad ?? 0) * Number(m.product?.precio ?? 0);
    };
    const productos = new Map<string, TopProducto>();
    const categorias = new Map<string, number>();
    lineas.forEach(m => {
      const nombre = m.product?.articulo ?? 'Producto';
      const p = productos.get(nombre) ?? { nombre, unidades: 0, total: 0 };
      p.unidades += Number(m.cantidad ?? 0);
      p.total += monto(m);
      productos.set(nombre, p);

      const c = m.product?.categoria;
      const cat = (typeof c === 'string' ? c : c?.nombre) || 'Sin categoría';
      categorias.set(cat, (categorias.get(cat) ?? 0) + monto(m));
    });
    this.topProductos = Array.from(productos.values()).sort((a, b) => b.total - a.total).slice(0, 5);

    this.graficos.forEach(g => g.destroy());
    this.graficos = [
      new Chart(this.ventasCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: meses.map(m => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`),
          datasets: [{ label: 'Ventas (BOB)', data: porMes, borderColor: '#009688', backgroundColor: 'rgba(0,150,136,.15)', fill: true, tension: .3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      }),
      new Chart(this.categoriaCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: Array.from(categorias.keys()),
          datasets: [{ data: Array.from(categorias.values()).map(v => Math.round(v * 100) / 100), backgroundColor: ['#009688', '#f08a24', '#3b82f6', '#8b5cf6', '#ef4444', '#64748b', '#eab308', '#14b8a6'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      })
    ];
  }

  moneda(v: number): string {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 2 }).format(v || 0);
  }
}
