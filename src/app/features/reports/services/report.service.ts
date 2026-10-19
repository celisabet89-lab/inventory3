import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { MovementsService } from '../../stock/services/movements.service';
import { CobroService } from '../../cobro/service/cobro.service';
import { PagoService } from '../../pago/service/pago.service';
import { DatosReporte } from './report.builders';

/**
 * Reúne los datos de movimientos, cobros y pagos. Los reportes se calculan en el
 * navegador (no hay endpoints /reports en el backend).
 */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private movimientos = inject(MovementsService);
  private cobros = inject(CobroService);
  private pagos = inject(PagoService);
  private http = inject(HttpClient);

  private lista(ruta: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/${ruta}`).pipe(catchError(() => of([] as any[])));
  }

  cargar(): Observable<DatosReporte> {
    return forkJoin({
      movs: this.movimientos.getAll().pipe(catchError(() => of([] as any[]))),
      cobros: this.cobros.getAll().pipe(catchError(() => of([]))),
      pagos: this.pagos.getAll().pipe(catchError(() => of([]))),
      usuarios: this.lista('user'),
      clientes: this.lista('cliente'),
      productos: this.lista('product'),
      proveedores: this.lista('proveedor'),
      onus: this.lista('onu'),
      existencias: this.lista('existing')
    });
  }
}
