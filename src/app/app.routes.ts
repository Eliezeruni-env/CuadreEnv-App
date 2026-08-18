import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

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
        path: 'inventory',
        loadComponent: () => import('../features/inventory/components/inventory/inventory.component').then((m) => m.InventoryComponent),
        data: { title: 'Inventory & Warehouses' }
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
