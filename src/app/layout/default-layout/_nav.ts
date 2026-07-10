import { INavData } from '@coreui/angular';

export const navItems: INavData[] = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    iconComponent: { name: 'cil-speedometer' }
  },
  {
    title: true,
    name: 'SaaS Core'
  },
  {
    name: 'Products',
    url: '/products',
    iconComponent: { name: 'cil-storage' }
  },
  {
    name: 'Inventory & Warehouses',
    url: '/inventory',
    iconComponent: { name: 'cil-swap-horizontal' }
  },
  {
    name: 'Sales Ledger',
    url: '/sales',
    iconComponent: { name: 'cil-cart' }
  },
  {
    name: 'Customers Directory',
    url: '/customers',
    iconComponent: { name: 'cil-user' }
  },
  {
    title: true,
    name: 'Accounting & Supply'
  },
  {
    name: 'Purchases Log',
    url: '/purchases',
    iconComponent: { name: 'cil-truck' }
  },
  {
    name: 'Payments Ledger',
    url: '/payments',
    iconComponent: { name: 'cil-credit-card' }
  },
  {
    name: 'Cash Register',
    url: '/cash-register',
    iconComponent: { name: 'cil-calculator' }
  },
  {
    title: true,
    name: 'Administration'
  },
  {
    name: 'Team & Users',
    url: '/users',
    iconComponent: { name: 'cil-people' }
  }
];
