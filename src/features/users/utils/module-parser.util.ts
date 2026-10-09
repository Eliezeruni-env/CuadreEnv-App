export function parseUserModules(user: any): string[] {
  if (!user) return [];

  // SuperAdmin global siempre retorna acceso total
  if (user.isSuperUser === true || String(user.role || '').toLowerCase() === 'superadmin') {
    return ['*'];
  }

  const raw = user.allowedModules ?? user.AllowedModules ?? user.AllowedModulesJson ?? user.allowedModulesJson;

  if (Array.isArray(raw)) {
    return [...new Set(raw.map(m => String(m).trim()).filter(Boolean))];
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '*' || trimmed === 'ALL' || trimmed === 'all') return ['*'];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map(m => String(m).trim()).filter(Boolean))];
      }
    } catch {
      return [];
    }
  }

  return [];
}

export interface MenuItemDefinition {
  id: string;
  canonical: string;
  name: string;
}

export interface MenuSectionDefinition {
  section: string;
  items: MenuItemDefinition[];
}

export const SAAS_MENU_SECTIONS: MenuSectionDefinition[] = [
  {
    section: 'Principal & Métricas',
    items: [
      { id: 'dashboard', canonical: 'dashboard', name: 'Dashboard' },
      { id: 'metrics', canonical: 'reports', name: 'Métricas Globales' },
      { id: 'mobile-pos', canonical: 'sales', name: 'Vista Móvil (PWA)' }
    ]
  },
  {
    section: 'Operaciones Comerciales',
    items: [
      { id: 'sales', canonical: 'sales', name: 'Ventas' },
      { id: 'billing', canonical: 'billing', name: 'Facturación & NCF' },
      { id: 'billing-reports-dgii', canonical: 'reports', name: 'Reportes DGII (606/607)' },
      { id: 'services', canonical: 'sales', name: 'Servicios' },
      { id: 'cash-register', canonical: 'cashregister', name: 'Caja' },
      { id: 'fraud-guardian', canonical: 'audit', name: 'Auditoría Antirrobo' },
      { id: 'receivables', canonical: 'receivables', name: 'Cobros' },
      { id: 'credit-notes', canonical: 'billing', name: 'Notas de Crédito' },
      { id: 'customers', canonical: 'customers', name: 'Clientes' }
    ]
  },
  {
    section: 'Inventario & Almacenes',
    items: [
      { id: 'inventory-stock', canonical: 'inventory', name: 'Control de Stock' },
      { id: 'inventory-entries', canonical: 'inventory', name: 'Entradas de Almacén' },
      { id: 'inventory-outlets', canonical: 'inventory', name: 'Salidas de Almacén' },
      { id: 'inventory-transfers', canonical: 'inventory', name: 'Transferencias' },
      { id: 'inventory-warehouses', canonical: 'inventory', name: 'Almacenes & Depósitos' },
      { id: 'inventory-manage-requests', canonical: 'audit', name: 'Autorizaciones / Auditoría' },
      { id: 'products', canonical: 'inventory', name: 'Catálogo de Productos' },
      { id: 'products-settings', canonical: 'inventory', name: 'Categorías y Tipos' }
    ]
  },
  {
    section: 'Compras & Proveedores',
    items: [
      { id: 'purchases-suppliers', canonical: 'purchases', name: 'Proveedores' },
      { id: 'purchases-orders', canonical: 'purchases', name: 'Órdenes de Compra' },
      { id: 'purchases-receipts', canonical: 'purchases', name: 'Recepciones de Mercancía' },
      { id: 'payments', canonical: 'purchases', name: 'Pagos a Proveedores' }
    ]
  },
  {
    section: 'Administración',
    items: [
      { id: 'profile', canonical: 'company', name: 'Mi Perfil' },
      { id: 'users', canonical: 'company', name: 'Usuarios y Equipo' },
      { id: 'admin-roles', canonical: 'company', name: 'Roles y Permisos' },
      { id: 'admin-roles-matrix', canonical: 'company', name: 'Matriz de Permisos' },
      { id: 'admin-approvals', canonical: 'audit', name: 'Bandeja de Aprobaciones' },
      { id: 'company-settings', canonical: 'company', name: 'Configuración de Empresa' }
    ]
  }
];

export const MENU_TO_CANONICAL: Record<string, string> = {
  'dashboard': 'dashboard',
  'metrics': 'reports',
  'mobile-pos': 'sales',
  'sales': 'sales',
  'billing': 'billing',
  'billing-reports-dgii': 'reports',
  'services': 'sales',
  'cash-register': 'cashregister',
  'cashregister': 'cashregister',
  'fraud-guardian': 'audit',
  'audit': 'audit',
  'receivables': 'receivables',
  'credit-notes': 'billing',
  'customers': 'customers',
  'inventory-stock': 'inventory',
  'inventory-entries': 'inventory',
  'inventory-outlets': 'inventory',
  'inventory-transfers': 'inventory',
  'inventory-warehouses': 'inventory',
  'inventory-manage-requests': 'audit',
  'inventory': 'inventory',
  'products': 'inventory',
  'products-settings': 'inventory',
  'purchases-suppliers': 'purchases',
  'purchases-orders': 'purchases',
  'purchases-receipts': 'purchases',
  'purchases': 'purchases',
  'payments': 'purchases',
  'profile': 'company',
  'users': 'company',
  'admin-roles': 'company',
  'admin-roles-matrix': 'company',
  'admin-approvals': 'audit',
  'company-settings': 'company',
  'company': 'company'
};
