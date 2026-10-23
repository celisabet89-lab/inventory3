
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
  private clientSvc = inject(ClientService);
  private lugarSvc = inject(LugarVentaService);

  clients = signal<any[]>([]);
  filteredClients = signal<any[]>([]);
  lugaresDB = signal<any[]>([]);
  loading = signal(false);

  searchTerm = '';
  filtroEstado = 'TODOS';

  showForm = signal(false);
  selectedClient: any = null;
  isEditMode = false;

  stats = signal({
    total: 0,
    activos: 0,
    inactivos: 0,
    lugares: 0
  });

  ngOnInit(): void {
    this.loadLugares();
    this.loadClients();
  }

  loadLugares(): void {
    this.lugarSvc.getAll().subscribe({
      next: data => {
        this.lugaresDB.set(data ?? []);
        this.calcStats(this.clients());
      },
      error: () => this.lugaresDB.set([])
    });
  }

  loadClients(): void {
    this.loading.set(true);

    this.clientSvc.getAll().subscribe({
      next: data => {
        const clientes = data ?? [];
        this.clients.set(clientes);
        this.calcStats(clientes);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({
          icon: 'error',
          title: 'No se pudieron cargar los clientes',
          text: 'Comprueba la conexión con el servidor e inténtalo nuevamente.'
        });
      }
    });
  }

  calcStats(clientes: any[]): void {
    this.stats.set({
      total: clientes.length,
      activos: clientes.filter(c => c.estado === 'ACTIVO').length,
      inactivos: clientes.filter(c => c.estado === 'INACTIVO').length,
      lugares: this.lugaresDB().length ||
        new Set(
          clientes
            .map(c => c.lugarVenta?.idLugarVenta ?? c.idLugarVenta)
            .filter((id: any) => id !== null && id !== undefined)
        ).size
    });
  }

  applyFilters(): void {
    let resultado = [...this.clients()];

    if (this.filtroEstado !== 'TODOS') {
      resultado = resultado.filter(c => c.estado === this.filtroEstado);
    }

    const termino = this.searchTerm.trim().toLocaleLowerCase();

    if (termino) {
      resultado = resultado.filter(c => {
        const campos = [
          c.nombre,
          c.apellido,
          this.getNombre(c),
          c.ci,
          c.telefono,
          c.gmail,
          c.email,
          c.nContrato,
          c.direccion,
          c.zona,
          c.estado,
          c.lugarVenta?.nombre,
          c.lugarVenta?.ciudad
        ];

        return campos.some(valor =>
          String(valor ?? '').toLocaleLowerCase().includes(termino)
        );
      });
    }

    this.filteredClients.set(resultado);
  }

  getLugarNombre(cliente: any): string {
    return cliente?.lugarVenta?.nombre ??
      this.lugaresDB().find(
        l => l.idLugarVenta === cliente?.idLugarVenta
      )?.nombre ??
      'Sin lugar asignado';
  }

  getNombre(cliente: any): string {
    return `${cliente?.nombre ?? ''} ${cliente?.apellido ?? ''}`.trim() || '—';
  }

  getIniciales(cliente: any): string {
    const nombre = cliente?.nombre?.trim()?.charAt(0) ?? '';
    const apellido = cliente?.apellido?.trim()?.charAt(0) ?? '';
    return `${nombre}${apellido}`.toUpperCase();
  }

  getEstadoClass(estado: string): string {
    return estado === 'ACTIVO' ? 'badge-activo' : 'badge-inactivo';
  }

  openNew(): void {
    this.selectedClient = null;
    this.isEditMode = false;
    this.showForm.set(true);
  }

  openEdit(cliente: any): void {
    this.selectedClient = cliente;
    this.isEditMode = true;
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedClient = null;
    this.isEditMode = false;
  }

  onSaved(): void {
    this.closeForm();
    this.loadClients();
  }

  deleteClient(cliente: any): void {
    const id = cliente?.idCliente ?? cliente?.id;

    if (id === null || id === undefined) {
      Swal.fire({
        icon: 'error',
        title: 'No se puede eliminar',
        text: 'El cliente no tiene un identificador válido.'
      });
      return;
    }

    Swal.fire({
      title: '¿Eliminar cliente?',
      html: `¿Seguro que deseas eliminar a <b>${this.getNombre(cliente)}</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(resultado => {
      if (!resultado.isConfirmed) {
        return;
      }

      this.clientSvc.delete(Number(id)).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Cliente eliminado',
            timer: 1400,
            showConfirmButton: false
          });
          this.loadClients();
        },
        error: err => {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo eliminar',
            text: err?.error?.message ??
              'Puede que el cliente tenga registros relacionados.'
          });
        }
      });
    });
  }
}
