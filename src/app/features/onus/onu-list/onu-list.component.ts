import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnuService } from '../services/onu.service';
import { OnuMovimiento, OnuOperacionesService } from '../services/onu-operaciones.service';
import { OnuFormComponent } from '../onu-form/onu-form.component';
import { Onu } from '../../../models/onu.model';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

interface OnuStats {
  total: number; disponibles: number; asignadas: number; enReparacion: number;
  observados: number; instalados: number; recogidos: number; defectuosos: number;
}

@Component({
  selector: 'app-onu-list',
  standalone: true,
  imports: [CommonModule, FormsModule, OnuFormComponent],
  templateUrl: './onu-list.component.html',
  styleUrls: ['./onu-list.component.css']
})
export class OnuListComponent implements OnInit {
  private onuService = inject(OnuService);
  private operaciones = inject(OnuOperacionesService);
  private router = inject(Router);

  onus = signal<Onu[]>([]);
  filteredOnus = signal<Onu[]>([]);
  loading = signal(false);

  showForm = signal(false);
  selectedOnu: Onu | null = null;
  isEditMode = false;

  stats = signal<OnuStats>({
    total: 0, disponibles: 0, asignadas: 0, enReparacion: 0,
    observados: 0, instalados: 0, recogidos: 0, defectuosos: 0
  });

  searchTerm = '';
  selectedEstado = 'TODOS';
  selectedMarca = 'TODAS';

  estadoOptions = [
    { value: 'TODOS', label: 'Todos los Estados' },
    { value: 'Disponible', label: 'Disponibles' },
    { value: 'Asignada', label: 'Asignadas' },
    { value: 'Mantenimiento', label: 'En Mantenimiento' },
    { value: 'Observado', label: 'Observados' },
    { value: 'Instalado', label: 'Instalados' },
    { value: 'Recogido', label: 'Recogidos' },
    { value: 'Defectuoso', label: 'Defectuosos' }
  ];
  /** Marcas que existen en las ONUs registradas (se actualiza sola). */
  marcaOptions = computed(() => {
    const marcas = new Set(this.onus().map(o => (o.marca ?? '').trim()).filter(Boolean));
    return ['TODAS', ...[...marcas].sort((a, b) => a.localeCompare(b, 'es'))];
  });

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = signal(1);
  Math = Math;

  ngOnInit(): void { this.loadOnus(); }

  loadOnus(): void {
    this.loading.set(true);
    this.onuService.getAll().subscribe({
      next: (data) => {
        this.onus.set(data);
        this.calculateStats(data);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las ONUs' });
      }
    });
  }

  calculateStats(onus: Onu[]): void {
    this.stats.set({
      total:        onus.length,
      disponibles:  onus.filter(o => o.estado === 'Disponible').length,
      asignadas:    onus.filter(o => o.estado === 'Asignada').length,
      enReparacion: onus.filter(o => o.estado === 'Mantenimiento' || o.estado === 'En Reparación').length,
      instalados:   onus.filter(o => o.estado === 'Instalado').length,
      observados:   onus.filter(o => o.estado === 'Observado').length,
      recogidos:    onus.filter(o => o.estado === 'Recogido').length,
      defectuosos:  onus.filter(o => o.estado === 'Defectuoso').length
    });
  }

  applyFilters(): void {
    let result = [...this.onus()];
    if (this.selectedEstado !== 'TODOS') result = result.filter(o => o.estado === this.selectedEstado);
    if (this.selectedMarca !== 'TODAS') result = result.filter(o => (o.marca ?? '').trim() === this.selectedMarca);
    const term = this.searchTerm.toLowerCase().trim();
    if (term) result = result.filter(o =>
      [o.serial, o.mac, o.modelo, o.marca, o.almacen, o.tipoPortador, o.portador, o.contrato]
        .some(v => String(v ?? '').toLowerCase().includes(term))
    );
    this.filteredOnus.set(result);
    this.totalPages.set(Math.ceil(result.length / this.itemsPerPage) || 1);
    this.currentPage = 1;
  }

  onSearchChange(): void { this.applyFilters(); }
  onEstadoChange(): void { this.applyFilters(); }
  onMarcaChange():  void { this.applyFilters(); }

  instalar(onu: Onu): void { if (onu.id) this.router.navigate(['/onus/assign', onu.id]); }

  openNew():  void { this.isEditMode = false; this.selectedOnu = null; this.showForm.set(true); }
  openEdit(onu: Onu): void { this.isEditMode = true; this.selectedOnu = onu; this.showForm.set(true); }
  closeForm(): void { this.showForm.set(false); this.selectedOnu = null; }
  onSaved():  void { this.closeForm(); this.loadOnus(); }

  deleteOnu(onu: Onu): void {
    if (onu.estado === 'Asignada' || onu.estado === 'Instalado') {
      Swal.fire({ icon: 'error', title: 'No se puede eliminar', text: 'Primero desasigna la ONU.' });
      return;
    }
    Swal.fire({
      title: '¿Eliminar ONU?',
      html: `<p><strong>${onu.marca} ${onu.modelo}</strong><br/><small>Serial: ${onu.serial}</small></p>`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed && onu.id) {
        this.onuService.delete(onu.id).subscribe({
          next: () => { Swal.fire({ icon: 'success', title: 'ONU Eliminada', timer: 1500, showConfirmButton: false }); this.loadOnus(); },
          error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar' })
        });
      }
    });
  }

  cambiarEstado(onu: Onu): void {
    const opts: any = {};
    this.estadoOptions.filter(e => e.value !== 'TODOS').forEach(e => opts[e.value] = e.label);
    Swal.fire({
      title: `Cambiar Estado — ${onu.marca} ${onu.modelo}`,
      input: 'select', inputOptions: opts, inputValue: onu.estado,
      inputLabel: 'Solo las ONUs "Disponible" cuentan en el stock del producto.',
      showCancelButton: true, confirmButtonColor: '#1b6f6f',
      confirmButtonText: 'Cambiar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed && onu.id) {
        const nuevoEstado = r.value as any;
        this.onuService.update(onu.id, { marca: onu.marca, modelo: onu.modelo, serial: onu.serial, mac: onu.mac, observaciones: onu.observaciones, estado: nuevoEstado, contrato: onu.contrato, codigoQR: onu.codigoQR, tipoPortador: onu.tipoPortador, portador: onu.portador, almacen: onu.almacen }).subscribe({
          next: () => { Swal.fire({ icon: 'success', title: `Estado: ${nuevoEstado}`, timer: 1800, showConfirmButton: false }); this.loadOnus(); },
          error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar' })
        });
      }
    });
  }

  private esc(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  viewDetails(onu: Onu): void {
    const cliente = onu.client ? `${onu.client.nombre ?? onu.client.name ?? ''} ${onu.client.apellido ?? ''}`.trim() : '';
    const base = `<div style="text-align:left;padding:8px;font-size:14px">
        <p><b>Serial:</b> ${this.esc(onu.serial)}</p>
        <p><b>MAC:</b> ${this.esc(onu.mac)}</p>
        <p><b>Estado:</b> ${this.esc(onu.estado)}</p>
        ${onu.almacen ? `<p><b>Almacén:</b> ${this.esc(onu.almacen)}</p>` : ''}
        ${onu.portador ? `<p><b>Portador:</b> ${this.esc(onu.portador)} <small>(${this.esc(onu.tipoPortador)})</small></p>` : ''}
        ${onu.contrato ? `<p><b>Contrato:</b> #${this.esc(onu.contrato)}</p>` : ''}
        ${onu.observaciones ? `<p><b>Observaciones:</b> ${this.esc(onu.observaciones)}</p>` : ''}
        ${cliente ? `<hr/><p><b>Cliente:</b> ${this.esc(cliente)}</p>` : ''}
      </div>`;

    const mostrar = (historial: OnuMovimiento[]) => {
      const nombres: Record<string, string> = { REGISTRO: 'Registro', ASIGNACION: 'Asignación', RECOJO: 'Recojo', DIAGNOSTICO: 'Diagnóstico' };
      const filas = historial.map(m => {
        // Quién: usuario y, entre paréntesis, su cargo
        const quien = m.usuario ? `${m.usuario}${m.cargo ? ` (${m.cargo})` : ''}` : (m.cargo ?? '');
        const alm = m.almacen ? `Almacén: ${m.almacen}` : '';
        return `<tr>
          <td style="padding:5px 6px;white-space:nowrap">${this.esc(new Date(m.fecha).toLocaleDateString('es-BO'))}</td>
          <td style="padding:5px 6px"><b>${this.esc(nombres[m.tipo] ?? m.tipo)}</b></td>
          <td style="padding:5px 6px">${this.esc(quien) || '—'}</td>
          <td style="padding:5px 6px">${this.esc([alm, m.detalle].filter(Boolean).join(' · ')) || '—'}</td>
        </tr>`;
      }).join('');
      const bloque = historial.length
        ? `<hr/><p style="text-align:left;margin:6px 8px"><b>Historial</b></p>
           <div style="max-height:240px;overflow:auto"><table style="width:100%;font-size:12px;text-align:left">
             <thead><tr style="color:#6b7280"><th style="padding:4px 6px">Fecha</th><th style="padding:4px 6px">Operación</th><th style="padding:4px 6px">Usuario (cargo)</th><th style="padding:4px 6px">Detalle</th></tr></thead>
             <tbody>${filas}</tbody></table></div>`
        : '';
      Swal.fire({ title: `${this.esc(onu.marca)} ${this.esc(onu.modelo)}`, html: base + bloque, icon: 'info', confirmButtonColor: '#1b6f6f', width: 720 });
    };

    if (!onu.id) { mostrar([]); return; }
    this.operaciones.movimientosDe(onu.id).subscribe({ next: mostrar, error: () => mostrar([]) });
  }

  getEstadoBadgeClass(estado: string): string {
    const m: any = { 'Disponible': 'badge-success', 'Asignada': 'badge-info', 'Mantenimiento': 'badge-warning', 'En Reparación': 'badge-warning', 'Instalado': 'badge-info', 'Observado': 'badge-warning', 'Recogido': 'badge-secondary', 'Defectuoso': 'badge-danger' };
    return m[estado] || 'badge-secondary';
  }

  getPaginatedOnus(): Onu[] { const s = (this.currentPage-1)*this.itemsPerPage; return this.filteredOnus().slice(s, s+this.itemsPerPage); }
  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages()) this.currentPage = p; }
  previousPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages()) this.currentPage++; }
  getPageNumbers(): number[] {
    const pages: number[] = []; const total = this.totalPages();
    const start = Math.max(1, this.currentPage - 2);
    for (let i = start; i <= Math.min(total, start + 4); i++) pages.push(i);
    return pages;
  }
}
