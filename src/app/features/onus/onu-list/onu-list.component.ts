import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnuService } from '../services/onu.service';
import { OnuFormComponent } from '../onu-form/onu-form.component';
import { Onu } from '../../../models/onu.model';
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
    { value: 'En Reparación', label: 'En Reparación' },
    { value: 'Observado', label: 'Observados' },
    { value: 'Instalado', label: 'Instalados' },
    { value: 'Recogido', label: 'Recogidos' },
    { value: 'Defectuoso', label: 'Defectuosos' }
  ];
  marcaOptions = ['TODAS', 'Huawei', 'ZTE', 'Nokia', 'Fiberhome', 'TP-LINK', 'Otro'];

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
      enReparacion: onus.filter(o => o.estado === 'Mantenimiento').length,
      instalados:   onus.filter(o => o.estado === 'Instalado').length,
      observados:   onus.filter(o => o.estado === 'Observado').length,
      recogidos:    onus.filter(o => o.estado === 'Recogido').length,
      defectuosos:  onus.filter(o => o.estado === 'Defectuoso').length
    });
  }

  applyFilters(): void {
    let result = [...this.onus()];
    if (this.selectedEstado !== 'TODOS') result = result.filter(o => o.estado === this.selectedEstado);
    if (this.selectedMarca !== 'TODAS') result = result.filter(o => o.marca === this.selectedMarca);
    const term = this.searchTerm.toLowerCase().trim();
    if (term) result = result.filter(o =>
      o.serial?.toLowerCase().includes(term) || o.mac?.toLowerCase().includes(term) ||
      o.modelo?.toLowerCase().includes(term) || o.marca?.toLowerCase().includes(term) ||
      String(o.contrato ?? '').includes(term)
    );
    this.filteredOnus.set(result);
    this.totalPages.set(Math.ceil(result.length / this.itemsPerPage) || 1);
    this.currentPage = 1;
  }

  onSearchChange(): void { this.applyFilters(); }
  onEstadoChange(): void { this.applyFilters(); }
  onMarcaChange():  void { this.applyFilters(); }

  openNew():  void { this.isEditMode = false; this.selectedOnu = null; this.showForm.set(true); }
  openEdit(onu: Onu): void { this.isEditMode = true; this.selectedOnu = onu; this.showForm.set(true); }
  closeForm(): void { this.showForm.set(false); this.selectedOnu = null; }
  onSaved():  void { this.closeForm(); this.loadOnus(); }

  deleteOnu(onu: Onu): void {
    if (onu.estado === 'Asignada') {
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
      showCancelButton: true, confirmButtonColor: '#1b6f6f',
      confirmButtonText: 'Cambiar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed && onu.id) {
        const nuevoEstado = r.value as any;
        this.onuService.update(onu.id, { marca: onu.marca, modelo: onu.modelo, serial: onu.serial, mac: onu.mac, observaciones: onu.observaciones, estado: nuevoEstado, contrato: onu.contrato, codigoQR: onu.codigoQR }).subscribe({
          next: () => { Swal.fire({ icon: 'success', title: `Estado: ${nuevoEstado}`, timer: 1800, showConfirmButton: false }); this.loadOnus(); },
          error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar' })
        });
      }
    });
  }

  viewDetails(onu: Onu): void {
    Swal.fire({
      title: `${onu.marca} ${onu.modelo}`,
      html: `<div style="text-align:left;padding:8px;font-size:14px">
        <p><b>Serial:</b> ${onu.serial}</p>
        <p><b>MAC:</b> ${onu.mac}</p>
        <p><b>Estado:</b> ${onu.estado}</p>
        ${onu.contrato ? `<p><b>Contrato:</b> #${onu.contrato}</p>` : ''}
        ${onu.observaciones ? `<p><b>Observaciones:</b> ${onu.observaciones}</p>` : ''}
        ${onu.client ? `<hr/><p><b>Cliente:</b> ${onu.client.nombre ?? onu.client.name} ${onu.client.apellido ?? ''}</p>` : ''}
      </div>`,
      icon: 'info', confirmButtonColor: '#1b6f6f'
    });
  }

  getEstadoBadgeClass(estado: string): string {
    const m: any = { 'Disponible': 'badge-success', 'Asignada': 'badge-info', 'En Reparación': 'badge-warning', 'Instalado': 'badge-info', 'Observado': 'badge-warning', 'Recogido': 'badge-secondary', 'Defectuoso': 'badge-danger' };
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
