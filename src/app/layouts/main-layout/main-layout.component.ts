import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService }     from '../../core/services/auth.service';
import { LoadingService }  from '../../core/services/loading.service';
import { UserService }     from '../../features/users/services/user.service';
import { User } from '../../models';
import Swal from 'sweetalert2';
import { filter } from 'rxjs/operators';

interface SubMenuItem {
  path: string;
  icon: string;
  label: string;
}

interface MenuItem {
  path: string;
  icon: string;
  label: string;
  badge?: number;
  adminOnly?: boolean;
  subItems?: SubMenuItem[];
  isOpen?: boolean;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router      = inject(Router);
  private userService = inject(UserService);
  loadingService      = inject(LoadingService);

  currentUser   = signal<User | null>(null);
  sidebarOpen   = signal(true);
  alertCount    = signal(0);
  totalTecnicos = signal(0);
  totalUsuarios = signal(0);

  menuItems: MenuItem[] = [
    {
      path: '/dashboard',
      icon: 'fa-chart-line',
      label: 'Dashboard'
    },
    {
      path: '/usuarios',
      icon: 'fa-users',
      label: 'Usuarios',
      subItems: [
        { path: '/usuarios/lista',           icon: 'fa-list',          label: 'Usuarios'           },
        { path: '/usuarios/roles',           icon: 'fa-user-tag',      label: 'Roles'              }
      ],
      isOpen: false
    },
    {
      path: '/clientes',
      icon: 'fa-user-friends',
      label: 'Clientes',
      subItems: [
        { path: '/clientes/lista',           icon: 'fa-list',          label: 'Clientes'           },
        { path: '/clientes/lugar-venta', icon: 'fa-store', label: 'Lugar de Venta' }
      ],
      isOpen: false
    },
    {
      path: '/productos',
      icon: 'fa-box',
      label: 'Productos',
      subItems: [
        { path: '/productos/lista',           icon: 'fa-list',          label: 'Productos'           },
        { path: '/productos/precio-venta',   icon: 'fa-tag',    label: 'Precio de Venta'  },
        { path: '/productos/unidad-medida',  icon: 'fa-ruler',  label: 'Unidad de Medida' },
        { path: '/productos/categoria',      icon: 'fa-folder', label: 'Categoría'        }
      ],
      isOpen: false
    },
    {path: '/proveedores', icon: 'fa-truck', label: 'Proveedores'},
    {
      path: '/movimientos',
      icon: 'fa-exchange-alt',
      label: 'Movimientos',
      subItems: [
        { path: '/movimientos/movimientos',   icon: 'fa-cart-plus',     label: 'Movimientos'  },
        { path: '/movimientos/gestion-compras',  icon: 'fa-shopping-cart', label: 'Gestiónar Compras' },
        { path: '/movimientos/reporte-compras',  icon: 'fa-chart-line',    label: 'Reporte Compras'   },
        { path: '/movimientos/ventas-anuladas',  icon: 'fa-ban',           label: 'Ventas Anuladas'   },
        { path: '/movimientos/alertas', icon: 'fa-exclamation-circle',     label: 'Alertas'   },
        {path: 'movimientos/stock', icon: 'fa-shopping-cart',     label: 'Stock'}

      ],
      isOpen: false
    },
    {
      path: '/cobros',
      icon: 'fa-hand-holding-usd',
      label: 'Cobros',
      subItems: [
        { path: '/cobros/pendientes', icon: 'fa-clock',       label: 'Cobros Pendientes' },
        { path: '/cobros/gestion',    icon: 'fa-credit-card', label: 'Gestión Cobros'    },
        { path: '/cobros/reporte',    icon: 'fa-chart-line',  label: 'Reporte Cobros'    }
      ],
      isOpen: false
    },
    {
      path: '/pagos',
      icon: 'fa-credit-card',
      label: 'Pagos',
      subItems: [
        { path: '/pagos/pendientes', icon: 'fa-clock',      label: 'Pagos Pendientes'  },
        { path: '/pagos/gestion',    icon: 'fa-money-bill', label: 'Gestiónar Pagos'   },
        { path: '/pagos/reporte',    icon: 'fa-chart-line', label: 'Reporte Pagos'     }
      ],
      isOpen: false
    },
    {
      path: '/reportes',
      icon: 'fa-file-alt',
      label: 'Reportes',
      subItems: [
        { path: '/reportes/ventas',      icon: 'fa-chart-line',         label: 'Reporte de Ventas'    },
        { path: '/reportes/ingresos',    icon: 'fa-dollar-sign',        label: 'Reporte de Ingresos'  },
        { path: '/reportes/cobranzas',   icon: 'fa-hand-holding-usd',   label: 'Reporte de Cobranzas' },
        { path: '/reportes/canastillos', icon: 'fa-shopping-basket',    label: 'Reporte de Canastillos'}
      ],
      isOpen: false
    },
    { path: '/onus',            icon: 'fa-wifi',          label: 'ONUs'         },
    //{ path: '/deliveries',      icon: 'fa-truck',         label: 'Entregas'     }
  ];

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => this.currentUser.set(user));
    this.loadUserStats();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkActiveSubmenu();
    });
  }

  checkActiveSubmenu(): void {
    const currentUrl = this.router.url;
    this.menuItems.forEach(item => {
      if (item.subItems) {
        const active = item.subItems.some(sub => currentUrl.includes(sub.path));
        if (active && this.sidebarOpen()) item.isOpen = true;
      }
    });
  }

  loadUserStats(): void {
    this.userService.getAll().subscribe({
      next: (users: any[]) => {
        const cargo = (u: any) => (u.profile?.cargo ?? u.rol?.cargo ?? '').toLowerCase();
        this.totalTecnicos.set(users.filter(u => cargo(u).includes('écnico') || cargo(u).includes('ecnico')).length);
        this.totalUsuarios.set(users.length);
      },
      error: () => {}
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
    if (!this.sidebarOpen()) {
      this.menuItems.forEach(item => { if (item.subItems) item.isOpen = false; });
    }
  }

  toggleSubmenu(item: MenuItem): void {
    if (!item.subItems) {
      // Sin submenú → navegar directamente
      this.router.navigate([item.path]);
      return;
    }
    if (this.sidebarOpen()) {
      item.isOpen = !item.isOpen;
    } else {
      // Sidebar cerrada → abrirla y expandir submenú
      this.sidebarOpen.set(true);
      item.isOpen = true;
    }
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  isSubmenuActive(subItems: SubMenuItem[]): boolean {
    return subItems.some(sub => this.router.url.includes(sub.path));
  }

  isMenuItemVisible(item: MenuItem): boolean {
    if (item.adminOnly) {
      const user = this.currentUser() as any;
      const cargo = (user?.profile?.cargo ?? user?.rol?.cargo ?? '').toLowerCase();
      return cargo.includes('admin') || this.authService.isAdmin();
    }
    return true;
  }

  logout(): void {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: '¿Estás seguro que deseas salir?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1b6f6f',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) this.authService.logout();
    });
  }

  getUserName(): string {
    const user = this.currentUser() as any;
    if (user?.profile?.name) return `${user.profile.name} ${user.profile.lastName ?? ""}`.trim();
    return user?.email ?? "Usuario";
  }

  getUserCargo(): string {
    const user = this.currentUser() as any;
    return user?.rol?.cargo ?? user?.profile?.cargo ?? "";
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (user?.profile) {
      return `${user.profile.name?.charAt(0) ?? ''}${(user.profile as any).lastName?.charAt(0) ?? ''}`;
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  }
}
