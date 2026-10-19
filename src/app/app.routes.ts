import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component')
      .then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/main-layout/main-layout.component')
      .then(m => m.MainLayoutComponent),
    children: [

      // ── Dashboard ──────────────────────────────────────────────
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard/dashboard.component')
          .then(m => m.DashboardComponent)
      },

      // ── Productos / Products ────────────────────────────────────
      {
        path: 'products',
        children: [
          { path: '', loadComponent: () => import('./features/products/product-list/product-list.component').then(m => m.ProductListComponent) },
          { path: 'new', loadComponent: () => import('./features/products/product-form/product-form.component').then(m => m.ProductFormComponent) },
          { path: 'edit/:id', loadComponent: () => import('./features/products/product-form/product-form.component').then(m => m.ProductFormComponent) }
        ]
      },
      // alias del menú nuevo
      {
        path: 'productos',
        children: [
          { path: '', loadComponent: () => import('./features/products/product-list/product-list.component').then(m => m.ProductListComponent) },
          { path: 'lista',  loadComponent: () => import('././features/products/product-list/product-list.component').then(m => m.ProductListComponent) },
          { path: 'precio-venta', loadComponent: () => import('./features/products/presioVenta/presioVenta-list/presioVenta-list.component').then(m => m.PresioVentaListComponent) },
          { path: 'unidad-medida', loadComponent: () => import('./features/products/unidadMedida/unidad-medida-list/unidad-medida-list.component').then(m => m.UnidadMedidaListComponent) },
          { path: 'categoria',     loadComponent: () => import('./features/products/categoria/categoria-list.component').then(m => m.CategoriaListComponent) }
        ]
      },

      // ── ONUs ────────────────────────────────────────────────────
      {
        path: 'onus',
        children: [
          { path: '', loadComponent: () => import('./features/onus/onu-list/onu-list.component').then(m => m.OnuListComponent) },
          { path: 'new', loadComponent: () => import('./features/onus/onu-form/onu-form.component').then(m => m.OnuFormComponent) },
          { path: 'assign/:id', loadComponent: () => import('./features/onus/onu-assignment/onu-assignment.component').then(m => m.OnuAssignmentComponent) }
        ]
      },

      // ── Entregas / Deliveries ───────────────────────────────────
      {
        path: 'deliveries',
        loadComponent: () => import('./features/deliveries/delivery-list/delivery-list.component')
          .then(m => m.DeliveryListComponent)
      },

      // ── Clientes / Clients ──────────────────────────────────────
      {
        path: 'clients',
        loadComponent: () => import('./features/clients/client-list/client-list.component')
          .then(m => m.ClientListComponent)
      },
      // alias del menú nuevo
      {
        path: 'clientes',
        children: [
          { path: '', loadComponent: () => import('./features/clients/client-list/client-list.component').then(m => m.ClientListComponent) },
          { path: 'lista', loadComponent: () => import('././features/clients/client-list/client-list.component').then(m => m.ClientListComponent) },
          { path: 'lugar-venta', loadComponent: () => import('./features/clients/lugar-venta/lugar-venta-list/lugar-venta-list.component').then(m => m.LugarVentaListComponent) },
        ]
      },

      // ── Usuarios / Users ────────────────────────────────────────
      {
        path: 'users',
        children: [
          { path: '', loadComponent: () => import('./features/users/user-list/user-list.component').then(m => m.UserListComponent) },
          { path: 'new', loadComponent: () => import('./features/users/user-form/user-form.component').then(m => m.UserFormComponent) },
          { path: 'edit/:id', loadComponent: () => import('./features/users/user-form/user-form.component').then(m => m.UserFormComponent) }
        ]
      },
      // alias del menú nuevo
      {
        path: 'usuarios',
        children: [
          { path: '', loadComponent: () => import('./features/users/user-list/user-list.component').then(m => m.UserListComponent) },
          { path: 'lista',             loadComponent: () => import('./features/users/user-list/user-list.component').then(m => m.UserListComponent) },
          { path: 'roles', loadComponent: () => import('./features/users/rol-list/rol-list.componente').then(m => m.RolListComponent) },
        ]
      },

      // ── Reportes / Reports ──────────────────────────────────────
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/report-dashboard/report-dashboard.component')
          .then(m => m.ReportDashboardComponent)
      },
      // alias del menú nuevo
      {
        path: 'reportes',
        children: [
          { path: '', loadComponent: () => import('./features/reports/report-dashboard/report-dashboard.component').then(m => m.ReportDashboardComponent) },
          { path: 'ventas', data: { reporte: 'VENTAS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) },
          { path: 'ingresos', data: { reporte: 'INGRESOS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) },
          { path: 'cobranzas', data: { reporte: 'COBRANZAS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) },
          { path: 'canastillos', data: { reporte: 'CANASTILLOS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) },
          { path: 'usuarios', data: { reporte: 'USUARIOS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) },
          { path: 'clientes', data: { reporte: 'CLIENTES' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) },
          { path: 'productos', data: { reporte: 'PRODUCTOS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) },
          { path: 'proveedores', data: { reporte: 'PROVEEDORES' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) },
          { path: 'onus', data: { reporte: 'ONUS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) }
        ]
      },

      // ── Movimientos (alias menú nuevo) ──────────────────────────
      {
        path: 'movimientos',
        children: [
          { path: '', loadComponent: () => import('./features/stock/movements-list/movements-list.component').then(m => m.MovementsListComponent) },
          { path: 'gestion-compras',  loadComponent: () => import('./features/stock/movements-manager/movements-manager.component').then(m => m.MovementsManagerComponent) },
          { path: 'reporte-compras',  loadComponent: () => import('./features/stock/movement-report/movement-report.component').then(m => m.MovementReportComponent) },
          { path: 'movimientos',   loadComponent: () => import('./features/stock/movements-list/movements-list.component').then(m => m.MovementsListComponent) },
          { path: 'alertas', loadComponent:() => import('./features/alerts/alert-panel/alert-panel.component').then(m=> m.AlertPanelComponent)},
          { path: 'existing',  loadComponent: () => import('./features/stock/existing-list/existing-list.component').then(m => m.ExistingListComponent) },
          { path: 'movements', loadComponent: () => import('./features/stock/movements-list/movements-list.component').then(m => m.MovementsListComponent) },
          { path: 'stock', loadComponent:()=> import('./features/stock/existing-list/existing-list.component').then(m=> m.ExistingListComponent)}
        ]
      },
      {
        path: 'proveedores',
        children: [
          { path: '', loadComponent: () => import('./features/proveedor/proveedor-list/proveedor-list.component').then(m => m.ProveedorListComponent) },
          { path: '', redirectTo: '/products', pathMatch: 'full' },
          { path: 'digital-coltd', redirectTo: '/products', pathMatch: 'full' }
        ]
      },

      // ── Cobros ──────────────────────────────────────────────────
      {
        path: 'cobros',
        children: [
          {path: '', loadComponent: () => import('./features/cobro/cobros-list/cobros-list.component').then(m => m.CobrosListComponent)},
          {path: 'pendientes', loadComponent: () => import('./features/cobro/cobros-list/cobros-list.component').then(m => m.CobrosListComponent)},
          {path: 'gestion', loadComponent: () => import('./features/cobro/cobros-list/cobros-list.component').then(m => m.CobrosListComponent)},
          { path: 'reporte', data: { reporte: 'COBROS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) }
        ]
      },

      // ── Pagos ───────────────────────────────────────────────────
      // Un solo componente para las dos pantallas: `data.vista` indica cuál es.
      //   pendientes → compras con saldo por pagar
      //   gestion    → compras pagadas por completo (historial, recibo, anular)
      {
        path: 'pagos',
        children: [
          { path: '', redirectTo: 'pendientes', pathMatch: 'full' },
          {
            path: 'pendientes',
            data: { vista: 'PENDIENTES' },
            loadComponent: () => import('./features/pago/pago-list/pago-list.component').then(m => m.PagoListComponent)
          },
          {
            path: 'gestion',
            data: { vista: 'GESTION' },
            loadComponent: () => import('./features/pago/pago-list/pago-list.component').then(m => m.PagoListComponent)
          },
          { path: 'reporte', data: { reporte: 'PAGOS' }, loadComponent: () => import('./features/reports/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent) }
        ]
      },

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
