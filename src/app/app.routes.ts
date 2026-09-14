import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '',
    loadComponent: () => import('../layout').then(m => m.DefaultLayoutComponent),
    canActivate: [authGuard],
    data: {
      title: 'Home'
    },
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('../features/dashboard/components/dashboard/routes').then((m) => m.routes)
      },
      {
        path: 'products',
        loadComponent: () => import('../features/products/components/products/products.component').then((m) => m.ProductsComponent),
        data: { title: 'Products Catalogue' }
      },
      {
        path: 'products/settings',
        loadComponent: () => import('../features/products/components/settings/product-settings.component').then((m) => m.ProductSettingsComponent),
        data: { title: 'Configuración de Productos' }
      },
      {
        path: 'inventory',
        loadComponent: () => import('../features/inventory/components/inventory/inventory.component').then((m) => m.InventoryComponent),
        data: { title: 'Inventory & Warehouses' }
      },
      {
        path: 'inventory/warehouses',
        loadComponent: () => import('../features/inventory/components/warehouse/warehouse-list.component').then((m) => m.WarehouseListComponent),
        data: { title: 'Gestión de Almacenes' }
      },
      {
        path: 'inventory/entries',
        loadComponent: () => import('../features/inventory/components/warehouse-entry/listwarehouse-entry.component').then((m) => m.ListwarehouseEntryComponent),
        data: { title: 'Entradas de Almacén' }
      },
      {
        path: 'inventory/entries/create',
        loadComponent: () => import('../features/inventory/components/warehouse-entry/createwarehouse-entry.component').then((m) => m.CreatewarehouseEntryComponent),
        data: { title: 'Nueva Entrada' }
      },
      {
        path: 'inventory/outlets',
        loadComponent: () => import('../features/inventory/components/warehouse-outlet/listwarehouse-outlet.component').then((m) => m.ListwarehouseOutletComponent),
        data: { title: 'Salidas de Almacén' }
      },
      {
        path: 'inventory/outlets/create',
        loadComponent: () => import('../features/inventory/components/warehouse-outlet/createwarehouse-outlet.component').then((m) => m.CreatewarehouseOutletComponent),
        data: { title: 'Nueva Salida' }
      },
      {
        path: 'inventory/transfers',
        loadComponent: () => import('../features/inventory/components/warehouse-transfer/listwarehouse-transfer.component').then((m) => m.ListwarehouseTransferComponent),
        data: { title: 'Transferencias entre Almacenes' }
      },
      {
        path: 'inventory/transfers/create',
        loadComponent: () => import('../features/inventory/components/warehouse-transfer/createwarehouse-transfer.component').then((m) => m.CreatewarehouseTransferComponent),
        data: { title: 'Nueva Transferencia' }
      },
      {
        path: 'inventory/stock',
        loadComponent: () => import('../features/inventory/components/stock/stock.component').then((m) => m.StockComponent),
        data: { title: 'Consulta de Existencias / Stock' }
      },
      {
        path: 'inventory/manage-requests',
        loadComponent: () => import('../features/inventory/components/manage-request/manage-request-list.component').then((m) => m.ManageRequestListComponent),
        data: { title: 'Bandeja de Aprobaciones' }
      },
      {
        path: 'purchases/receipts',
        loadComponent: () => import('../features/purchases/components/purchase-order-receipt/purchase-order-receipt-list.component').then((m) => m.PurchaseOrderReceiptListComponent),
        data: { title: 'Recepciones de Compra' }
      },
      {
        path: 'purchases/receipts/create',
        loadComponent: () => import('../features/purchases/components/purchase-order-receipt/purchase-order-receipt-form.component').then((m) => m.PurchaseOrderReceiptFormComponent),
        data: { title: 'Nueva Recepción' }
      },
      {
        path: 'purchases/receipts/create/:id',
        loadComponent: () => import('../features/purchases/components/purchase-order-receipt/purchase-order-receipt-form.component').then((m) => m.PurchaseOrderReceiptFormComponent),
        canActivate: [() => import('./guards/reception-exists.guard').then(m => m.ReceptionExistsGuard)],
        data: { title: 'Recepción de Orden' }
      },
      {
        path: 'users',
        loadComponent: () => import('../features/users/components/users/users.component').then((m) => m.UsersComponent),
        data: { title: 'Team Management' }
      },
      {
        path: 'sales',
        loadComponent: () => import('../features/sales/components/sales/sales.component').then((m) => m.SalesComponent),
        data: { title: 'Sales Register' }
      },
      {
        path: 'receivables',
        loadComponent: () => import('../features/sales/components/receivables/receivables.component').then((m) => m.ReceivablesComponent),
        data: { title: 'Ventas por Cobrar' }
      },
      {
        path: 'sales/receivables',
        redirectTo: 'receivables',
        pathMatch: 'full'
      },
      {
        path: 'billing',
        loadComponent: () => import('../features/billing/components/listbilling/listbilling.component').then((m) => m.ListbillingComponent),
        data: { title: 'Facturación y Comprobantes Fiscales' }
      },
      {
        path: 'billing/create',
        loadComponent: () => import('../features/billing/components/createbilling/createbilling.component').then((m) => m.CreatebillingComponent),
        data: { title: 'Nueva Factura' }
      },
      {
        path: 'billing/quotationNo/:quotationNo',
        loadComponent: () => import('../features/billing/components/createbilling/createbilling.component').then((m) => m.CreatebillingComponent),
        data: { title: 'Facturar Cotización' }
      },
      {
        path: 'credit-notes',
        loadComponent: () => import('../features/sales/components/credit-notes/credit-notes.component').then((m) => m.CreditNotesComponent),
        data: { title: 'Notas de Crédito y Devoluciones' }
      },
      {
        path: 'sales/credit-notes',
        redirectTo: 'credit-notes',
        pathMatch: 'full'
      },
      {
        path: 'customers',
        loadComponent: () => import('../features/customers/components/customers/customers.component').then((m) => m.CustomersComponent),
        data: { title: 'Customers Directory' }
      },
      {
        path: 'purchases',
        loadComponent: () => import('../features/purchases/components/purchases/purchases.component').then((m) => m.PurchasesComponent),
        data: { title: 'Purchases Log' }
      },
      {
        path: 'payments',
        loadComponent: () => import('../features/payments/components/payments/payments.component').then((m) => m.PaymentsComponent),
        data: { title: 'Payments Ledger' }
      },
      {
        path: 'cash-register',
        loadComponent: () => import('../features/cash-register/components/cash-register/cash-register.component').then((m) => m.CashRegisterComponent),
        data: { title: 'Cash Register Control' }
      },
      {
        path: 'metrics',
        loadComponent: () => import('../features/dashboard/components/metrics/metrics.component').then((m) => m.MetricsComponent),
        data: { title: 'Métricas Globales' }
      },
      {
        path: 'services',
        loadComponent: () => import('../features/services/components/services-list/services-list.component').then((m) => m.ServicesListComponent),
        data: { title: 'Catálogo de Servicios' }
      },
      {
        path: 'purchases/suppliers',
        loadComponent: () => import('../features/purchases/components/suppliers/suppliers.component').then((m) => m.SuppliersComponent),
        data: { title: 'Directorio de Proveedores' }
      },
      {
        path: 'suppliers',
        redirectTo: 'purchases/suppliers',
        pathMatch: 'full'
      },
      {
        path: 'profile',
        loadComponent: () => import('../features/users/components/user-profile/user-profile.component').then((m) => m.UserProfileComponent),
        data: { title: 'Mi Perfil' }
      },
      {
        path: 'admin/roles',
        loadComponent: () => import('../features/roles/components/roles-list/roles-list.component').then((m) => m.RolesListComponent),
        canActivate: [adminGuard],
        data: { title: 'Gestión de Roles y Permisos' }
      },
      {
        path: 'roles',
        redirectTo: 'admin/roles',
        pathMatch: 'full'
      },
      {
        path: 'admin/roles/matrix',
        loadComponent: () => import('../features/roles/components/permission-matrix/permission-matrix.component').then((m) => m.PermissionMatrixComponent),
        canActivate: [adminGuard],
        data: { title: 'Matriz de Permisos' }
      },
      {
        path: 'admin/approvals',
        loadComponent: () => import('../features/approvals/components/approval-inbox/approval-inbox.component').then((m) => m.ApprovalInboxComponent),
        data: { title: 'Bandeja de Aprobaciones' }
      },
      {
        path: 'approvals',
        redirectTo: 'admin/approvals',
        pathMatch: 'full'
      },
      {
        path: 'company/settings',
        loadComponent: () => import('../features/companies/components/company-settings/company-settings.component').then((m) => m.CompanySettingsComponent),
        canActivate: [adminGuard],
        data: { title: 'Configuración de Empresa' }
      },
      {
        path: 'companies/settings',
        redirectTo: 'company/settings',
        pathMatch: 'full'
      },
      {
        path: 'pages',
        loadChildren: () => import('../features/pages/components/pages/routes').then((m) => m.routes)
      }
    ]
  },
  {
    path: 'companies/create',
    loadComponent: () => import('../features/companies/components/companies/create-company.component').then(m => m.CreateCompanyComponent),
    canActivate: [authGuard],
    data: { title: 'Register Company' }
  },
  {
    path: 'accept-invitation',
    loadComponent: () => import('../features/pages/components/pages/accept-invitation/accept-invitation.component').then(m => m.AcceptInvitationComponent),
    data: { title: 'Join Team' }
  },
  {
    path: '404',
    loadComponent: () => import('../features/pages/components/pages/page404/page404.component').then(m => m.Page404Component),
    data: {
      title: 'Page 404'
    }
  },
  {
    path: '500',
    loadComponent: () => import('../features/pages/components/pages/page500/page500.component').then(m => m.Page500Component),
    data: {
      title: 'Page 500'
    }
  },
  {
    path: 'login',
    loadComponent: () => import('../features/pages/components/pages/login/login.component').then(m => m.LoginComponent),
    data: {
      title: 'Login Page'
    }
  },
  {
    path: 'register',
    loadComponent: () => import('../features/pages/components/pages/register/register.component').then(m => m.RegisterComponent),
    data: {
      title: 'Register Page'
    }
  },
  { path: '**', redirectTo: 'dashboard' }
];
