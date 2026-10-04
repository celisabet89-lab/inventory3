import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';
import { UserFormComponent } from '../user-form/user-form.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, UserFormComponent],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);

  users         = signal<any[]>([]);
  filteredUsers = signal<any[]>([]);
  loading       = signal(false);
  showForm      = signal(false);
  selectedUser: number | null = null;
  isEditMode = false;

  searchTerm = '';
  filtroRol  = 'TODOS';

  // Roles únicos extraídos del backend (se llenan dinámicamente)
  rolesDisponibles = signal<string[]>([]);

  stats = signal({ total: 0, admins: 0, tecnicos: 0, encargados: 0 });

  ngOnInit(): void { this.loadUsers(); }

  // Extrae el cargo real de un usuario
  getCargo(u: any): string {
    return (u.rol?.cargo ?? u.profile?.cargo ?? '').trim();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.userService.getAll().subscribe({
      next: (data: any[]) => {
        console.log('Usuarios cargados:', data.map(u => ({
          email: u.email,
          rolCargo: u.rol?.cargo,
          profileCargo: u.profile?.cargo
        })));

        this.users.set(data);

        // Extraer roles únicos reales del backend
        const roles = [...new Set(data.map(u => this.getCargo(u)).filter(c => c !== ''))];
        this.rolesDisponibles.set(roles);

        this.calcStats(data);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  calcStats(users: any[]): void {
    const c = (u: any) => this.getCargo(u).toLowerCase();
    this.stats.set({
      total:      users.length,
      admins:     users.filter(u => c(u).includes('admin')).length,
      tecnicos:   users.filter(u => c(u).includes('écnico') || c(u).includes('ecnico')).length,
      encargados: users.filter(u => c(u).includes('encargado')).length
    });
  }

  applyFilters(): void {
    let list = [...this.users()];

    // Filtro por búsqueda
    const t = this.searchTerm.toLowerCase().trim();
    if (t) list = list.filter(u =>
      u.email?.toLowerCase().includes(t) ||
      u.profile?.name?.toLowerCase().includes(t) ||
      u.profile?.lastName?.toLowerCase().includes(t) ||
      this.getCargo(u).toLowerCase().includes(t)
    );

    // Filtro por rol — comparación exacta con el cargo real del backend
    if (this.filtroRol !== 'TODOS') {
      list = list.filter(u => this.getCargo(u) === this.filtroRol);
    }

    this.filteredUsers.set(list);
  }

  openNew():  void { this.isEditMode = false; this.selectedUser = null; this.showForm.set(true); }
  openEdit(u: any): void { this.isEditMode = true; this.selectedUser = u.idUser; this.showForm.set(true); }
  closeForm(): void { this.showForm.set(false); this.selectedUser = null; }
  onSaved():  void { this.closeForm(); this.loadUsers(); }

  deleteUser(u: any): void {
    const nombre = this.getNombre(u);
    Swal.fire({
      title: '¿Eliminar usuario?',
      html: `¿Estás seguro de eliminar a <strong>${nombre}</strong>?`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed && u.idUser)
        this.userService.delete(u.idUser).subscribe({
          next: () => { Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1400, showConfirmButton: false }); this.loadUsers(); },
          error: () => Swal.fire({ icon: 'error', title: 'Error al eliminar' })
        });
    });
  }

  getNombre(u: any): string {
    if (u?.profile?.name) return `${u.profile.name} ${u.profile.lastName ?? ''}`.trim();
    return u?.email ?? '—';
  }

  getIniciales(u: any): string {
    const n = this.getNombre(u);
    return n !== '—' ? n.charAt(0).toUpperCase() : 'U';
  }

  getRolBadgeClass(cargo: string): string {
    const c = cargo.toLowerCase();
    if (c.includes('admin'))                        return 'badge-admin';
    if (c.includes('écnico') || c.includes('ecnico')) return 'badge-tec';
    if (c.includes('encargado'))                    return 'badge-enc';
    return 'badge-user';
  }
}
