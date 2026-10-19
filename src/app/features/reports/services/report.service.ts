import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { MovementsService } from '../../stock/services/movements.service';
import { CobroService } from '../../cobro/service/cobro.service';
import { PagoService } from '../../pago/service/pago.service';
import { DatosReporte } from './report.service.spec';

/**
 * Reúne los datos de movimientos, cobros y pagos. Los reportes se calculan en el
 * navegador (no hay endpoints /reports en el backend).
 */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private movimientos = inject(MovementsService);
  private cobros = inject(CobroService);
  private pagos = inject(PagoService);

  cargar(): Observable<DatosReporte> {
    return forkJoin({
      movs: this.movimientos.getAll().pipe(catchError(() => of([] as any[]))),
      cobros: this.cobros.getAll().pipe(catchError(() => of([]))),
      pagos: this.pagos.getAll().pipe(catchError(() => of([])))
    });
  }
}
