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
    loadComponent: () => import('./layout').then(m => m.DefaultLayoutComponent),
    canActivate: [authGuard],
    data: {
      title: 'Home'
    },
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./views/dashboard/routes').then((m) => m.routes)
      },
      {
        path: 'products',
        loadComponent: () => import('./views/products/products.component').then((m) => m.ProductsComponent),
        data: { title: 'Products Catalogue' }
      },
      {
        path: 'inventory',
        loadComponent: () => import('./views/inventory/inventory.component').then((m) => m.InventoryComponent),
        data: { title: 'Inventory & Warehouses' }
      },
      {
        path: 'users',
        loadComponent: () => import('./views/users/users.component').then((m) => m.UsersComponent),
        data: { title: 'Team Management' }
      },
      {
        path: 'sales',
        loadComponent: () => import('./views/sales/sales.component').then((m) => m.SalesComponent),
        data: { title: 'Sales Register' }
      },
      {
        path: 'customers',
        loadComponent: () => import('./views/customers/customers.component').then((m) => m.CustomersComponent),
        data: { title: 'Customers Directory' }
      },
      {
        path: 'purchases',
        loadComponent: () => import('./views/purchases/purchases.component').then((m) => m.PurchasesComponent),
        data: { title: 'Purchases Log' }
      },
      {
        path: 'payments',
        loadComponent: () => import('./views/payments/payments.component').then((m) => m.PaymentsComponent),
        data: { title: 'Payments Ledger' }
      },
      {
        path: 'cash-register',
        loadComponent: () => import('./views/cash-register/cash-register.component').then((m) => m.CashRegisterComponent),
        data: { title: 'Cash Register Control' }
      },
      {
        path: 'pages',
        loadChildren: () => import('./views/pages/routes').then((m) => m.routes)
      }
    ]
  },
  {
    path: 'companies/create',
    loadComponent: () => import('./views/companies/create-company.component').then(m => m.CreateCompanyComponent),
    canActivate: [authGuard],
    data: { title: 'Register Company' }
  },
  {
    path: 'accept-invitation',
    loadComponent: () => import('./views/pages/accept-invitation/accept-invitation.component').then(m => m.AcceptInvitationComponent),
    data: { title: 'Join Team' }
  },
  {
    path: '404',
    loadComponent: () => import('./views/pages/page404/page404.component').then(m => m.Page404Component),
    data: {
      title: 'Page 404'
    }
  },
  {
    path: '500',
    loadComponent: () => import('./views/pages/page500/page500.component').then(m => m.Page500Component),
    data: {
      title: 'Page 500'
    }
  },
  {
    path: 'login',
    loadComponent: () => import('./views/pages/login/login.component').then(m => m.LoginComponent),
    data: {
      title: 'Login Page'
    }
  },
  {
    path: 'register',
    loadComponent: () => import('./views/pages/register/register.component').then(m => m.RegisterComponent),
    data: {
      title: 'Register Page'
    }
  },
  { path: '**', redirectTo: 'dashboard' }
];
