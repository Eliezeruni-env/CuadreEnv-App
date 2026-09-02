import { INavData } from '@coreui/angular';

export const navItems: INavData[] = [
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
    name: 'Inventario & Almacenes',
  },
  {
    name: 'Control de Stock',
    url: '/inventory/stock',
    iconComponent: { name: 'cil-storage' },
  },
  {
    name: 'Entradas de Almacén',
    url: '/inventory/entries',
    iconComponent: { name: 'cil-arrow-right' },
  },
  {
    name: 'Salidas de Almacén',
    url: '/inventory/outlets',
    iconComponent: { name: 'cil-arrow-left' },
  },
  {
    name: 'Transferencias',
    url: '/inventory/transfers',
    iconComponent: { name: 'cil-swap-horizontal' },
  },
  {
    name: 'Almacenes & Depósitos',
    url: '/inventory/warehouses',
    iconComponent: { name: 'cil-home' },
  },
  {
    name: 'Autorizaciones / Auditoría',
    url: '/inventory/manage-requests',
    iconComponent: { name: 'cil-check-circle' },
  },
  {
    name: 'Catálogo de Productos',
    url: '/products',
    iconComponent: { name: 'cil-layers' },
  },
  {
    name: 'Categorías y Tipos',
    url: '/products/settings',
    iconComponent: { name: 'cil-settings' },
  },
  {
    title: true,
    name: 'Compras & Proveedores',
  },
  {
    name: 'Órdenes de Compra',
    url: '/purchases',
    iconComponent: { name: 'cil-truck' },
  },
  {
    name: 'Recepciones de Mercancía',
    url: '/purchases/receipts',
    iconComponent: { name: 'cil-task' },
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
