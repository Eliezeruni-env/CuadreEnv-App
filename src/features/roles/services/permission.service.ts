import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiClientService } from '../../cuadreEnv/services/apiClient';
import { AuthService } from '../../cuadreEnv/services/auth.service';
import type { PermissionDto, RoleDto } from '../../cuadreEnv/types/api';

export interface ModuleDefinition {
  key: PermissionDto['module'];
  label: string;
  description: string;
  icon: string;
}

export const SYSTEM_MODULES: ModuleDefinition[] = [
  { key: 'Sales', label: 'Ventas & POS', description: 'Cotizaciones, órdenes de venta y comprobantes', icon: 'cil-cart' },
  { key: 'Billing', label: 'Facturación & NCF', description: 'Emisión de comprobantes fiscales y notas de crédito', icon: 'cil-notes' },
  { key: 'Inventory', label: 'Inventario & Almacenes', description: 'Control de existencias, entradas, salidas y depósitos', icon: 'cil-storage' },
  { key: 'CashRegister', label: 'Caja & Movimientos', description: 'Aperturas, arqueos, cierres y movimientos de efectivo', icon: 'cil-calculator' },
  { key: 'Receivables', label: 'Cuentas por Cobrar', description: 'Cobranzas, amortizaciones y estados de cuenta', icon: 'cil-dollar' },
  { key: 'Customers', label: 'Clientes & CRM', description: 'Directorio de clientes, límites de crédito y contactos', icon: 'cil-user' },
  { key: 'Purchases' as any, label: 'Compras & Proveedores', description: 'Órdenes de compra, recepciones y pagos a proveedores', icon: 'cil-truck' },
  { key: 'Audit', label: 'Auditoría & Trazabilidad', description: 'Bitácora de eventos, fraud guardian y aprobaciones', icon: 'cil-shield-alt' },
  { key: 'Reports', label: 'Reportes & Análisis', description: 'Métricas financieras, ventas y estadísticas operativas', icon: 'cil-chart-pie' },
  { key: 'Company', label: 'Administración de Empresa', description: 'Configuración fiscal, usuarios y roles del tenant', icon: 'cil-settings' },
];

export const ACTIONS_LIST: Array<{ key: PermissionDto['action']; label: string; badgeColor: string }> = [
  { key: 'View', label: 'Consultar (Ver)', badgeColor: 'info' },
  { key: 'Create', label: 'Crear', badgeColor: 'success' },
  { key: 'Edit', label: 'Modificar (Editar)', badgeColor: 'warning' },
  { key: 'Delete', label: 'Eliminar', badgeColor: 'danger' },
  { key: 'Approve', label: 'Aprobar', badgeColor: 'primary' },
  { key: 'Export', label: 'Exportar', badgeColor: 'secondary' },
];

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private api = inject(ApiClientService);
  private authService = inject(AuthService);

  private readonly _userRolesSubject = new BehaviorSubject<string[]>([]);
  readonly userRoles$: Observable<string[]> = this._userRolesSubject.asObservable();

  // Cached full catalog of system permissions
  readonly permissionsCatalog = signal<PermissionDto[]>(this.generateDefaultCatalog());

  // Active user's aggregated permission tokens: "module:action" (e.g. "sales:view", "inventory:create")
  readonly userPermissionTokens = signal<Set<string>>(new Set());

  constructor() {
    this.refreshUserPermissions();
  }

  generateDefaultCatalog(): PermissionDto[] {
    let id = 1;
    const list: PermissionDto[] = [];
    for (const mod of SYSTEM_MODULES) {
      for (const act of ACTIONS_LIST) {
        list.push({
          id: id++,
          module: mod.key,
          action: act.key,
          description: `Permite ${act.label.toLowerCase()} en el módulo de ${mod.label}`,
        });
      }
    }
    return list;
  }

  async loadCatalog(): Promise<PermissionDto[]> {
    try {
      let res: any;
      try {
        res = await this.api.get<any, any>('/permissions');
      } catch {
        res = await this.api.get<any, any>('/Permission');
      }
      if (Array.isArray(res) && res.length > 0) {
        this.permissionsCatalog.set(res);
        return res;
      }
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        this.permissionsCatalog.set(res.data);
        return res.data;
      }
    } catch {
      // Graceful fallback to default full matrix
    }
    return this.permissionsCatalog();
  }

  refreshUserPermissions(customRoles?: RoleDto[]): void {
    const isSuper = this.authService.isSuperUser();
    const primaryRole = (this.authService.currentRole() || '').toLowerCase();
    const allRoles = (this.authService.currentRoles() || []).map((r) => r.toLowerCase());
    if (primaryRole && !allRoles.includes(primaryRole)) {
      allRoles.push(primaryRole);
    }

    this._userRolesSubject.next(allRoles);

    const tokens = new Set<string>();

    if (isSuper || allRoles.some((r) => ['admin', 'superuser', 'sysadmin', 'superadmin'].includes(r))) {
      // Admin / SuperAdmin has complete permission over all modules
      for (const mod of SYSTEM_MODULES) {
        for (const act of ACTIONS_LIST) {
          tokens.add(`${mod.key.toLowerCase()}:${act.key.toLowerCase()}`);
        }
      }
      this.userPermissionTokens.set(tokens);
      return;
    }

    // 1. Prioridad: Permisos y módulos asignados explícitamente desde USM en el JWT
    const jwtModules =
      typeof this.authService.allowedModules === 'function'
        ? this.authService.allowedModules() || []
        : [];
    const jwtPermissions =
      typeof this.authService.userPermissions === 'function'
        ? this.authService.userPermissions() || []
        : [];

    if (jwtModules.length > 0 || jwtPermissions.length > 0) {
      for (const mod of jwtModules) {
        const m = mod.toLowerCase().trim();
        tokens.add(`${m}:view`);
        tokens.add(`${m}:create`);
        tokens.add(`${m}:edit`);
        tokens.add(`${m}:export`);
      }

      for (const perm of jwtPermissions) {
        const p = perm.toLowerCase().trim();
        if (p.includes(':')) {
          tokens.add(p);
        } else {
          tokens.add(`${p}:view`);
          tokens.add(`${p}:create`);
        }
      }

      this.userPermissionTokens.set(tokens);
      return;
    }

    // 2. Roles personalizados recibidos por parámetro
    if (customRoles && customRoles.length > 0) {
      for (const r of customRoles) {
        if (allRoles.includes(r.name.toLowerCase()) && r.permissions) {
          for (const p of r.permissions) {
            tokens.add(`${p.module.toLowerCase()}:${p.action.toLowerCase()}`);
          }
        }
      }
    }

    // 3. Fallbacks para roles estándar del sistema si no provienen de USM
    for (const role of allRoles) {
      if (role === 'audit' || role === 'auditor') {
        for (const mod of SYSTEM_MODULES) {
          tokens.add(`${mod.key.toLowerCase()}:view`);
          tokens.add(`${mod.key.toLowerCase()}:edit`);
          tokens.add(`${mod.key.toLowerCase()}:export`);
        }
        tokens.add('audit:approve');
      } else if (role === 'vendedor' || role === 'seller') {
        tokens.add('sales:view');
        tokens.add('sales:create');
        tokens.add('inventory:view');
        tokens.add('customers:view');
        tokens.add('customers:create');
      } else if (role === 'cajero' || role === 'cashier') {
        tokens.add('sales:view');
        tokens.add('sales:create');
        tokens.add('cashregister:view');
        tokens.add('cashregister:create');
        tokens.add('billing:view');
        tokens.add('billing:create');
      } else if (role === 'supervisor') {
        for (const mod of ['sales', 'inventory', 'cashregister', 'customers', 'reports', 'purchases']) {
          tokens.add(`${mod}:view`);
          tokens.add(`${mod}:create`);
          tokens.add(`${mod}:edit`);
          tokens.add(`${mod}:export`);
        }
        tokens.add('cashregister:approve');
      } else {
        tokens.add('sales:view');
        tokens.add('inventory:view');
        tokens.add('customers:view');
      }
    }

    this.userPermissionTokens.set(tokens);
  }

  hasPermission(module: string, action: string): boolean {
    const isSuper = this.authService.isSuperUser();
    const primaryRole = (this.authService.currentRole() || '').toLowerCase();
    const allRoles = (this.authService.currentRoles() || []).map((r) => r.toLowerCase());

    if (isSuper || primaryRole === 'admin' || allRoles.some((r) => ['admin', 'superuser', 'sysadmin', 'superadmin'].includes(r))) {
      return true;
    }

    const token = `${module.trim().toLowerCase()}:${action.trim().toLowerCase()}`;
    return this.userPermissionTokens().has(token);
  }

  /**
   * Resuelve el módulo funcional correspondiente a una ruta de navegación.
   */
  resolveModuleFromRoute(path: string): string | null {
    const p = path.toLowerCase().trim();
    if (!p || p === '/dashboard' || p === 'dashboard' || p === '/profile') {
      return 'dashboard';
    }
    if (p.startsWith('/metrics') || p === '/billing/reports') return 'reports';
    if (p.startsWith('/sales') || p.startsWith('/mobile')) return 'sales';
    if (p.startsWith('/billing') || p.startsWith('/credit-notes')) return 'billing';
    if (p.startsWith('/services')) return 'sales';
    if (p === '/cash-register/fraud-guardian') return 'audit';
    if (p.startsWith('/cash-register')) return 'cashregister';
    if (p.startsWith('/receivables')) return 'receivables';
    if (p.startsWith('/customers')) return 'customers';
    if (p.startsWith('/inventory/manage-requests')) return 'audit';
    if (p.startsWith('/inventory') || p.startsWith('/products')) return 'inventory';
    if (p.startsWith('/purchases') || p.startsWith('/payments')) return 'purchases';
    if (p.startsWith('/admin/approvals')) return 'audit';
    if (p.startsWith('/admin/roles') || p.startsWith('/users') || p.startsWith('/company')) return 'company';
    return null;
  }

  /**
   * Determina si el usuario actual tiene acceso a visualizar y operar un módulo o ruta,
   * respetando los módulos configurados en el USM.
   */
  hasModuleAccess(urlOrModule: string): boolean {
    const isSuper = this.authService.isSuperUser();
    const primaryRole = (this.authService.currentRole() || '').toLowerCase();
    const allRoles = (this.authService.currentRoles() || []).map((r) => r.toLowerCase());

    if (isSuper || primaryRole === 'admin' || allRoles.some((r) => ['admin', 'superuser', 'sysadmin', 'superadmin'].includes(r))) {
      return true;
    }

    const cleanPath = (urlOrModule || '').toLowerCase().trim();
    if (!cleanPath || cleanPath === '/dashboard' || cleanPath === 'dashboard' || cleanPath === '/profile') {
      return true;
    }

    const targetModule = this.resolveModuleFromRoute(cleanPath) || cleanPath.replace(/^\//, '');

    // 1. Validar contra allowedModules emitidos por USM
    const rawAllowed =
      typeof this.authService.allowedModules === 'function'
        ? this.authService.allowedModules() || []
        : [];
    const allowed = rawAllowed.map((m) => m.toLowerCase().trim());
    if (allowed.length > 0) {
      if (allowed.includes('*') || allowed.includes('all')) return true;
      return allowed.includes(targetModule);
    }

    // 2. Validar contra tokens de permisos agregados (ej. sales:view)
    return (
      this.hasPermission(targetModule, 'view') ||
      this.hasPermission(targetModule, 'create') ||
      this.hasPermission(targetModule, 'edit')
    );
  }
}
