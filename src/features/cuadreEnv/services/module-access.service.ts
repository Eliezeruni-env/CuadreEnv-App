import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModuleAccessService {
  private allowedModules: string[] = [];
  public allowedModulesSignal = signal<string[]>([]);

  public hasAllModulesSignal = computed(() => {
    const mods = this.allowedModulesSignal();
    return mods.includes('*') || mods.includes('ALL') || mods.includes('all');
  });

  /**
   * Tabla de Normalización de Alias y Sub-módulos para CuadreEnv SaaS
   */
  private readonly MODULE_ALIASES: Record<string, string[]> = {
    dashboard: ['dashboard', 'inicio', 'metrics', 'mobile-pos'],
    sales: ['sales', 'ventas', 'pos', 'services', 'quick-sale', 'mobile', 'mobile-pos'],
    cashregister: ['cashregister', 'cash-register', 'caja', 'cash_register'],
    billing: ['billing', 'facturacion', 'invoicing', 'credit-notes', 'ncf', 'billing-reports-dgii'],
    receivables: ['receivables', 'cobros', 'cuentas-por-cobrar'],
    customers: ['customers', 'clientes', 'crm'],
    inventory: [
      'inventory',
      'inventario',
      'inventory-stock',
      'stock',
      'products',
      'warehouses',
      'transfers',
      'entries',
      'outlets',
      'inventory-entries',
      'inventory-outlets',
      'inventory-transfers',
      'inventory-warehouses',
      'inventory-manage-requests'
    ],
    purchases: [
      'purchases',
      'compras',
      'suppliers',
      'proveedores',
      'payments',
      'receipts',
      'purchases-orders',
      'purchases-suppliers',
      'purchases-receipts'
    ],
    reports: ['reports', 'reportes', 'metrics', 'dgii', '606', '607'],
    audit: ['audit', 'auditoria', 'fraud-guardian', 'approvals', 'manage-requests'],
    company: [
      'company',
      'empresa',
      'users',
      'usuarios',
      'roles',
      'profile',
      'settings',
      'company-settings',
      'admin-roles',
      'admin-approvals'
    ]
  };

  constructor() {
    this.loadStoredModules();
  }

  /**
   * Actualiza el signal reactivo de módulos permitidos y sincroniza el almacenamiento local.
   */
  public setAllowedModules(modules: unknown): void {
    let list: string[] = [];

    if (typeof modules === 'string') {
      const trimmed = modules.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          list = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
        } catch {
          list = trimmed.includes(',') ? trimmed.split(',') : [trimmed];
        }
      }
    } else if (Array.isArray(modules)) {
      list = modules.map(String);
    } else if (modules && typeof modules === 'object') {
      const obj = modules as Record<string, unknown>;
      const raw = obj['assignedModules'] ?? obj['modules'] ?? obj['allowedModules'] ?? obj['AllowedModulesJson'];
      if (raw) {
        return this.setAllowedModules(raw);
      }
    }

    this.allowedModules = list.map(m => m.trim()).filter(Boolean);
    const normalized = this.allowedModules.map(m => m.trim().toLowerCase());
    this.allowedModulesSignal.set(normalized);

    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        localStorage.setItem('allowed_modules', JSON.stringify(this.allowedModules));
      }
      if (window.sessionStorage) {
        sessionStorage.setItem('allowedModules', JSON.stringify(this.allowedModules));
        sessionStorage.setItem('hasAllModules', JSON.stringify(this.hasAllModulesSignal()));
      }
    }
  }

  public init(modules: unknown): void {
    this.setAllowedModules(modules);
  }

  /**
   * Carga inicial desde localStorage/sessionStorage al inicializar la aplicación.
   */
  public loadStoredModules(): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('allowed_modules') || sessionStorage.getItem('allowedModules');
        if (stored) {
          this.setAllowedModules(JSON.parse(stored));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Método principal de verificación de acceso a módulos con soporte de alias canónicos.
   */
  public hasModuleAccess(requiredModuleCode: string): boolean {
    const currentModules = this.allowedModulesSignal();
    const legacyModules = this.allowedModules;

    // 1. Acceso Global / Wildcard para SuperAdmin o Acceso Total
    if (
      currentModules.includes('*') ||
      currentModules.includes('all') ||
      legacyModules.includes('*') ||
      legacyModules.includes('ALL')
    ) {
      return true;
    }

    if (!requiredModuleCode) return true;
    const targetCode = requiredModuleCode.trim().toLowerCase();

    // 2. Módulos universales
    if (targetCode === 'dashboard') {
      return currentModules.length > 0 || legacyModules.length > 0;
    }
    if (targetCode === 'profile') {
      return true;
    }

    // 3. Coincidencia directa
    if (currentModules.includes(targetCode) || legacyModules.some(m => m.toLowerCase() === targetCode)) {
      return true;
    }

    // 4. Coincidencia por alias normalizados
    for (const [canonicalCode, aliases] of Object.entries(this.MODULE_ALIASES)) {
      const isTargetInFamily = canonicalCode === targetCode || aliases.includes(targetCode);
      if (isTargetInFamily) {
        const userHasFamilyPermission =
          currentModules.some(m => m === canonicalCode || aliases.includes(m)) ||
          legacyModules.some(m => {
            const lowerM = m.toLowerCase();
            return lowerM === canonicalCode || aliases.includes(lowerM);
          });

        if (userHasFamilyPermission) return true;
      }
    }

    return false;
  }

  public hasModule(moduleCode: string): boolean {
    return this.hasModuleAccess(moduleCode);
  }

  get modules(): string[] {
    return [...this.allowedModulesSignal()];
  }

  get hasAllModules(): boolean {
    return this.hasAllModulesSignal();
  }
}
