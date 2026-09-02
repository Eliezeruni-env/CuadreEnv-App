import type { INavData } from '@coreui/angular';

export const ADMIN_NAV_ITEMS: INavData[] = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    iconComponent: { name: 'cil-speedometer' },
  },
  {
    title: true,
    name: 'Operaciones Comerciales',
  },
  {
    name: 'Ventas',
    url: '/sales',
    iconComponent: { name: 'cil-cart' },
  },
  {
    name: 'Facturación & NCF',
    url: '/billing',
    iconComponent: { name: 'cil-notes' },
  },
  {
    name: 'Caja',
    url: '/cash-register',
    iconComponent: { name: 'cil-calculator' },
  },
  {
    name: 'Cobros',
    url: '/receivables',
    iconComponent: { name: 'cil-dollar' },
  },
  {
    name: 'Notas de Crédito',
    url: '/credit-notes',
    iconComponent: { name: 'cil-description' },
  },
  {
    name: 'Clientes',
    url: '/customers',
    iconComponent: { name: 'cil-user' },
  },
  {
    title: true,
    name: 'Catálogo e Inventario',
  },
  {
    name: 'Inventario y Almacenes',
    url: '/inventory',
    iconComponent: { name: 'cil-swap-horizontal' },
  },
  {
    name: 'Productos',
    url: '/products',
    iconComponent: { name: 'cil-storage' },
  },
  {
    name: 'Categorías y Tipos',
    url: '/products/settings',
    iconComponent: { name: 'cil-settings' },
  },
  {
    title: true,
    name: 'Contabilidad y Proveedores',
  },
  {
    name: 'Compras',
    url: '/purchases',
    iconComponent: { name: 'cil-truck' },
  },
  {
    name: 'Pagos a Proveedores',
    url: '/payments',
    iconComponent: { name: 'cil-credit-card' },
  },
  {
    title: true,
    name: 'Administración',
  },
  {
    name: 'Usuarios y Equipo',
    url: '/users',
    iconComponent: { name: 'cil-people' },
  },
];
