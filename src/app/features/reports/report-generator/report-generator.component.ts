import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { ReportsService } from '../services/report.service';
import {
  DatosReporte, FiltrosReporte, REPORTES, TipoReporte, construirReporte, infoDe,
  mesActual, opcionesContraparte, opcionesFormaPago
} from '../services/report.builders';
import { exportarExcel, exportarPdf } from '../../../shared/exportar/exportar.util';

@Component({
  selector: 'app-report-generator',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './report-generator.component.html',
  styleUrl: './report-generator.component.css'
})
export class ReportGeneratorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private reportes = inject(ReportsService);

  readonly lista = REPORTES;

  tipo: TipoReporte = (this.route.snapshot.data['reporte'] as TipoReporte) ?? 'COBRANZAS';

  constructor() {
    if (this.tipo === 'CANASTILLOS') this.filtros.palabra = 'canast';
  }
  formato: 'PDF' | 'EXCEL' = 'PDF';

  filtros: FiltrosReporte = {
    desde: mesActual(),
    hasta: mesActual(),
    contraparte: '',
    formaPago: '',
    palabra: ''
  };

  datos: DatosReporte = { movs: [], cobros: [], pagos: [] };
  contrapartes: string[] = [];
  formasPago: string[] = [];
  cargando = false;

  get info() {
    return infoDe(this.tipo);
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  elegir(tipo: TipoReporte): void {
    this.tipo = tipo;
    this.filtros.contraparte = '';
    this.filtros.palabra = tipo === 'CANASTILLOS' ? 'canast' : '';
    this.actualizarOpciones();
  }

  private cargarDatos(despues?: () => void): void {
    this.cargando = true;
    this.reportes.cargar().subscribe({
      next: datos => {
        this.datos = datos;
        this.actualizarOpciones();
        this.cargando = false;
        despues?.();
      },
      error: () => {
        this.cargando = false;
        Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
      }
    });
  }

  private actualizarOpciones(): void {
    this.contrapartes = opcionesContraparte(this.tipo, this.datos);
    this.formasPago = opcionesFormaPago(this.datos);
  }

  generar(): void {
    if (this.filtros.desde > this.filtros.hasta && !this.info.soloHasta && !this.info.esListado) {
      Swal.fire('Período inválido', 'El mes inicial no puede ser posterior al final.', 'warning');
      return;
    }
    // Se vuelven a pedir los datos para que el reporte salga actualizado.
    this.cargarDatos(() => this.emitir());
  }

  private emitir(): void {
    const tabla = construirReporte(this.tipo, this.datos, this.filtros);

    if (!tabla.filas.length) {
      Swal.fire('Sin datos', 'No hay registros para los filtros seleccionados.', 'info');
      return;
    }

    if (this.formato === 'EXCEL') {
      const nombre = `${tabla.titulo.replace(/\s+/g, '_')}_${this.filtros.hasta}`;
      exportarExcel(tabla, nombre);
    } else if (!exportarPdf(tabla)) {
      Swal.fire('Ventana bloqueada', 'Permite las ventanas emergentes para ver el PDF.', 'warning');
    }
  }
}
