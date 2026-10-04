import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import { MovementsService } from '../services/movements.service';

@Component({
  selector: 'app-movement-report',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './movement-report.component.html',
  styleUrls: ['./movement-report.component.css']
})
export class MovementReportComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private movSvc = inject(MovementsService);

  loading = signal(true);
  movimientos = signal<any[]>([]);
  movimiento = signal<any | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.cargarUno(+id);
    } else {
      this.cargarTodos();
    }
  }

  cargarUno(id: number): void {
    this.loading.set(true);
    this.movSvc.getAll().subscribe({
      next: (data: any[]) => {
        const mov = data.find(x => x.idMovimiento == id);
        this.movimiento.set(mov ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  cargarTodos(): void {
    this.loading.set(true);
    this.movSvc.getAll().subscribe({
      next: (data: any[]) => {
        this.movimientos.set([...data].reverse());
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  volver(): void {
    this.router.navigate(['/stock/movements']);
  }

  imprimir(): void {
    window.print();
  }

  esEntrada(tipo: string): boolean {
    return tipo === 'ENTRADA';
  }

  formatMoneda(v: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(v || 0);
  }
}
