import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientService } from '../services/client.service';
import { LugarVentaService } from '../services/lugar-venta.service';
import { ClientFormComponent } from '../client-form/client-form.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientFormComponent],
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.css']
})
export class ClientListComponent implements OnInit {
  private clientSvc    = inject(ClientService);
  private lugarSvc     = inject(LugarVentaService);

  clients         = signal<any[]>([]);
  filteredClients = signal<any[]>([]);
  lugaresDB       = signal<any[]>([]);
  loading         = signal(false);
  searchTerm      = '';
  filtroEstado    = 'TODOS';

  showForm        = signal(false);
  selectedClient: any = null;
  isEditMode      = false;

  stats = signal({ total:0, activos:0, inactivos:0, lugares:0 });

  ngOnInit(): void {
    this.lugarSvc.getAll().subscribe({ next: d => this.lugaresDB.set(d), error: () => {} });
    this.loadClients();
  }

  loadClients(): void {
    this.loading.set(true);
    this.clientSvc.getAll().subscribe({
      next: data => {
        this.clients.set(data);
        this.calcStats(data);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  calcStats(c: any[]): void {
    this.stats.set({
      total:    c.length,
      activos:  c.filter(x => x.estado === 'ACTIVO').length,
      inactivos:c.filter(x => x.estado === 'INACTIVO').length,
      lugares:  new Set(c.map(x => x.lugarVenta?.idLugarVenta).filter(Boolean)).size
    });
  }

  applyFilters(): void {
    let r = [...this.clients()];
    if (this.filtroEstado !== 'TODOS')
      r = r.filter(c => c.estado === this.filtroEstado);
    const t = this.searchTerm.toLowerCase().trim();
    if (t) r = r.filter(c =>
      c.nombre?.toLowerCase().includes(t) ||
      c.apellido?.toLowerCase().includes(t) ||
      c.ci?.toLowerCase().includes(t) ||
      c.telefono?.toLowerCase().includes(t) ||
      c.nContrato?.toLowerCase().includes(t)
    );
    this.filteredClients.set(r);
  }

  getLugarNombre(c: any): string {
    return c?.lugarVenta?.nombre ?? '—';
  }

  getNombre(c: any): string {
    return `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || '—';
  }

  getIniciales(c: any): string {
    return (c.nombre?.charAt(0) ?? '') + (c.apellido?.charAt(0) ?? '');
  }

  getEstadoClass(e: string): string {
    return e === 'ACTIVO' ? 'badge-activo' : 'badge-inactivo';
  }

  openNew(): void {
    this.showForm.set(false);
    this.selectedClient = null;
    this.isEditMode = false;
    setTimeout(() => this.showForm.set(true), 0);
  }

  openEdit(c: any): void {
    this.showForm.set(false);
    this.selectedClient = c;
    this.isEditMode = true;
    setTimeout(() => this.showForm.set(true), 0);
  }

  closeForm(): void { this.showForm.set(false); this.selectedClient = null; }
  onSaved():    void { this.closeForm(); this.loadClients(); }

  deleteClient(c: any): void {
    Swal.fire({
      title: '¿Eliminar cliente?',
      html: `¿Seguro que deseas eliminar a <b>${this.getNombre(c)}</b>?`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed && c.id)
        this.clientSvc.delete(c.idCliente).subscribe({
          next: () => { Swal.fire({icon:'success',title:'Eliminado',timer:1400,showConfirmButton:false}); this.loadClients(); },
          error: () => Swal.fire({icon:'error',title:'Error al eliminar'})
        });
    });
  }
}
