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
  { key: 'Sales', label: 'Ventas & Facturación', description: 'Cotizaciones, órdenes de venta y comprobantes', icon: 'cil-cart' },
  { key: 'Billing', label: 'Facturación & NCF', description: 'Emisión de comprobantes fiscales y notas de crédito', icon: 'cil-notes' },
  { key: 'Inventory', label: 'Inventario & Almacenes', description: 'Control de existencias, entradas, salidas y depósitos', icon: 'cil-storage' },
  { key: 'CashRegister', label: 'Caja & Movimientos', description: 'Aperturas, arqueos, cierres y movimientos de efectivo', icon: 'cil-calculator' },
  { key: 'Receivables', label: 'Cuentas por Cobrar', description: 'Cobranzas, amortizaciones y estados de cuenta', icon: 'cil-dollar' },
  { key: 'Customers', label: 'Clientes & CRM', description: 'Directorio de clientes, límites de crédito y contactos', icon: 'cil-user' },
  { key: 'Audit', label: 'Auditoría & Trazabilidad', description: 'Bitácora de eventos y solicitudes de eliminación', icon: 'cil-shield-alt' },
  { key: 'Reports', label: 'Reportes & Análisis', description: 'Métricas financieras, ventas y estadísticas operativas', icon: 'cil-chart-pie' },
  { key: 'Company', label: 'Administración de Empresa', description: 'Configuración fiscal, datos de empresa y roles', icon: 'cil-settings' },
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
      const res = await this.api.get<any, any>('/permissions');
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

    // Check custom roles if passed or found
    if (customRoles && customRoles.length > 0) {
      for (const r of customRoles) {
        if (allRoles.includes(r.name.toLowerCase()) && r.permissions) {
          for (const p of r.permissions) {
            tokens.add(`${p.module.toLowerCase()}:${p.action.toLowerCase()}`);
          }
        }
      }
    }

    // Standard preset role fallbacks:
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
        for (const mod of ['sales', 'inventory', 'cashregister', 'customers', 'reports']) {
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
}
