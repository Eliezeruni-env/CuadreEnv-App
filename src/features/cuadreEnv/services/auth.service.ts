import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  ApiClientService,
  doLogin,
  doRefresh,
  logout as clientLogout,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  setCompanyId,
  purgeTenantStorage,
} from './apiClient';
import type {
  LoginRequestDto,
  RegisterRequestDto,
  TokenResponseDto,
  UserResponseDto,
  ApiResponse,
} from '../types/api';
import { API_CONSTANTS } from '../../../app/constants';
import { NotificationService } from './notification.service';
import { SessionInvalidationService } from './session-invalidation.service';
import { ModuleAccessService } from './module-access.service';

interface DecodedToken {
  email?: string;
  Email?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'?: string;
  sub?: string; // userId
  id?: string | number;
  userId?: string | number;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'?: string;
  name?: string;
  fullName?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'?: string;
  role?: string;
  roles?: string[] | string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string | string[];
  companyId?: string | number;
  CompanyId?: string | number;
  company_id?: string | number;
  tenantId?: string | number;
  TenantId?: string | number;
  tenant_id?: string | number;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid'?: string | number;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid'?: string | number;
  isSuperUser?: boolean | string;
  IsSuperUser?: boolean | string;
  is_superuser?: boolean | string;
  exp?: number;
  permissions?: string[] | string;
  Permissions?: string[] | string;
  permission?: string[] | string;
  modules?: string[] | string;
  Modules?: string[] | string;
  allowed_modules?: string[] | string;
  allowedModules?: string[] | string;
  AllowedModulesJson?: string[] | string;
  allowedModulesJson?: string[] | string;
  [key: string]: any;
}

interface AuthenticatedUser {
  email: string;
  id: number;
  fullName?: string;
  allowedModules: string[];
}

interface LoginResponseUser extends Record<string, unknown> {
  allowedModules?: unknown;
  AllowedModules?: unknown;
  allowedModulesJson?: unknown;
  AllowedModulesJson?: unknown;
  modules?: unknown;
  Modules?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly sessionInvalidation = inject(SessionInvalidationService);
  public readonly moduleAccessService = inject(ModuleAccessService);
  private moduleEntitlementRefresh: Promise<boolean> | null = null;
  private moduleRefreshInterval: number | null = null;
  private entitlementErrorNotified = false;

  currentUser = signal<AuthenticatedUser | null>(null);
  currentRole = signal<string | null>(null);
  currentRoles = computed<string[]>(() => {
    const r = this.currentRole();
    return r ? [r] : [];
  });
  companyId = signal<number | null>(null);
  userPermissions = signal<string[]>([]);
  allowedModules = signal<string[]>([]);
  licensedModules = signal<string[] | null>(null);
  hasAllModules = computed(() => this.allowedModules().includes('*'));
  hasExplicitModuleClaims = signal(false);
  isPlatformSuperUser = signal(false);
  isAuthenticated = signal<boolean>(false);
  isInitializing = signal<boolean>(true);

  constructor() {
    this.sessionInvalidation.invalidated$.subscribe(() => this.clearSession());
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.refreshModulesWhenActive);
      document.addEventListener('visibilitychange', this.refreshModulesWhenActive);
      this.moduleRefreshInterval = window.setInterval(
        this.refreshModulesInBackground,
        30_000,
      );
    }
    this.initializeSession();
  }

  private readonly refreshModulesWhenActive = () => {
    if (
      this.isAuthenticated() &&
      (document.visibilityState === 'visible' || document.visibilityState === undefined)
    ) {
      void this.refreshModuleEntitlements(true);
    }
  };

  private readonly refreshModulesInBackground = () => {
    if (this.isAuthenticated() && document.visibilityState === 'visible') {
      void this.refreshModuleEntitlements(true);
    }
  };

  private async initializeSession() {
    const at = getAccessToken();
    let hasValidAccessToken = false;
    if (at) {
      const decoded = this.decodeJwt(at);
      if (decoded && (!decoded.exp || decoded.exp * 1000 > Date.now())) {
        this.applyDecodedToken(decoded);
        hasValidAccessToken = this.isAuthenticated();
        if (this.allowedModules().length === 0 && !getRefreshToken()) {
          this.clearSession();
          hasValidAccessToken = false;
        }
      } else {
        this.clearSession();
      }
    }

    const rt = getRefreshToken();
    if (rt) {
      try {
        const tokens = await doRefresh(this.api);
        if (tokens?.accessToken) {
          this.handleTokenResponse(tokens, false);
        } else {
          throw new Error('La API no devolvió un token de acceso renovado.');
        }
      } catch (error) {
        if (hasValidAccessToken && this.isAuthenticated()) {
          console.warn('[AuthService] Falló la renovación; se conserva la sesión mientras el token de acceso siga vigente.', error);
        } else {
          console.error('[AuthService] No se pudieron actualizar los permisos de la sesión.', error);
          this.notificationService.error(
            'La sesión expiró y no se pudo renovar. Inicia sesión nuevamente.',
          );
          this.clearSession();
        }
      }
    }

    if (this.isAuthenticated()) {
      await this.refreshModuleEntitlements();
    }

    // El tenant debe provenir exclusivamente del claim firmado del JWT emitido por el backend.
    // No se utiliza localStorage como fuente de autoridad si no existe un token válido.

    this.isInitializing.set(false);
  }

  private decodeJwt(token: string): DecodedToken | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  private applyDecodedToken(decoded: DecodedToken, responseUser?: Record<string, unknown>) {
    const email =
      decoded.email ||
      decoded.Email ||
      decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
      decoded.sub ||
      '';
    const rawId =
      decoded.sub ||
      decoded.id ||
      decoded.userId ||
      decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
      '0';
    const id = parseInt(rawId.toString(), 10) || 0;
    const fullName =
      decoded.name ||
      decoded.fullName ||
      decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
    
    let rawRole =
      decoded.role ||
      decoded.roles ||
      decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      null;

    if (Array.isArray(rawRole)) {
      rawRole = rawRole[0] || null;
    }

    const rawCompanyId =
      decoded.companyId ??
      decoded.CompanyId ??
      decoded.company_id ??
      decoded.tenantId ??
      decoded.TenantId ??
      decoded.tenant_id ??
      decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid'] ??
      decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid'];
      
    let compId: number | null = null;
    if (rawCompanyId !== undefined && rawCompanyId !== null) {
      const parsed = parseInt(rawCompanyId.toString(), 10);
      compId = !isNaN(parsed) && parsed > 0 ? parsed : (rawCompanyId as any);
    }

    const responseModuleKey = responseUser
      ? [
          'allowedModules',
          'AllowedModules',
          'allowedModulesJson',
          'AllowedModulesJson',
          'modules',
          'Modules',
        ]
          .find((key) => Object.prototype.hasOwnProperty.call(responseUser, key)) ?? null
      : null;
    const responseHasAllowedModules = responseModuleKey !== null;
    const rawResponseModules = responseModuleKey ? responseUser?.[responseModuleKey] : undefined;
    const parsedResponseModules = this.parseStringList(rawResponseModules);

    this.currentRole.set(rawRole);
    this.companyId.set(compId);
    this.hasExplicitModuleClaims.set(
      responseHasAllowedModules ||
      ['modules', 'Modules', 'allowed_modules', 'allowedModules', 'AllowedModulesJson', 'allowedModulesJson'].some(
        (claim) => Object.prototype.hasOwnProperty.call(decoded, claim) && decoded[claim] !== null,
      ),
    );
    const rawSuperUser = decoded.isSuperUser ?? decoded.IsSuperUser ?? decoded.is_superuser;
    this.isPlatformSuperUser.set(
      rawSuperUser === true || (typeof rawSuperUser === 'string' && rawSuperUser.toLowerCase() === 'true'),
    );

    // Extraer permisos asignados desde el JWT emitido por USM/Backend
    const rawPermissions =
      decoded.permissions ??
      decoded.Permissions ??
      decoded.permission ??
      decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/userdata'] ??
      [];
    const parsedPermissions = this.parseStringList(rawPermissions);

    // Extraer módulos permitidos definidos para este rol en USM
    const rawModules =
      decoded.AllowedModulesJson ??
      decoded.allowedModulesJson ??
      decoded.modules ??
      decoded.Modules ??
      decoded.allowed_modules ??
      decoded.allowedModules ??
      [];
    const parsedModules = responseHasAllowedModules
      ? parsedResponseModules
      : this.parseStringList(rawModules);
    const normalizedModules = this.normalizeModuleList(parsedModules);

    this.userPermissions.set(parsedPermissions);
    this.allowedModules.set(normalizedModules);
    this.currentUser.set({ email, id, fullName, allowedModules: normalizedModules });
    this.isAuthenticated.set(true);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('allowedModules', JSON.stringify(normalizedModules));
      sessionStorage.setItem('hasAllModules', JSON.stringify(this.hasAllModules()));
    }
    this.moduleAccessService.init(normalizedModules);

    if (typeof window !== 'undefined' && window.localStorage) {
      if (compId) {
        localStorage.setItem(API_CONSTANTS.COMPANY_ID_KEY, String(compId));
        localStorage.setItem('companyId', String(compId));
        localStorage.setItem('auth_company_id', String(compId));
      } else {
        localStorage.removeItem(API_CONSTANTS.COMPANY_ID_KEY);
      }
    }
  }

  private parseStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(String).map((item) => item.trim()).filter(Boolean);
    }
    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      // Claims are also emitted as comma-separated strings by the API.
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  private normalizeModuleList(modules: readonly string[]): string[] {
    return [...new Set(modules.map((module) => this.normalizeModuleCode(module)).filter(Boolean))];
  }

  private normalizeModuleCode(moduleCode: string): string {
    const compact = moduleCode
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9*]/g, '');
    const aliases: Record<string, string> = {
      '*': '*',
      sale: 'sales',
      ventas: 'sales',
      venta: 'sales',
      cash: 'cashregister',
      cashregister: 'cashregister',
      cashregisters: 'cashregister',
      caja: 'cashregister',
      inventory: 'inventory',
      inventorystock: 'inventory',
      inventoryentries: 'inventory',
      inventorytransfers: 'inventory',
      stock: 'inventory',
      inventario: 'inventory',
      warehouse: 'inventory',
      warehouses: 'inventory',
      billing: 'billing',
      billingreportsdgii: 'reports',
      facturacion: 'billing',
      customers: 'customers',
      customer: 'customers',
      clientes: 'customers',
      cliente: 'customers',
      purchases: 'purchases',
      purchase: 'purchases',
      compras: 'purchases',
      compra: 'purchases',
      suppliers: 'purchases',
      proveedor: 'purchases',
      proveedores: 'purchases',
      receivables: 'receivables',
      cobros: 'receivables',
      cuentasporcobrar: 'receivables',
      reports: 'reports',
      reporte: 'reports',
      reportes: 'reports',
      metricas: 'metrics',
      fraudguardian: 'audit',
      auditoria: 'audit',
      aprobaciones: 'audit',
      mobilepos: 'sales',
      adminroles: 'company',
      adminrolesmatrix: 'company',
      adminapprovals: 'company',
      companysettings: 'company',
      users: 'users',
      audit: 'audit',
      company: 'company',
      empresa: 'company',
      usuarios: 'company',
      roles: 'company',
      pagos: 'payments',
      servicios: 'services',
      productos: 'products',
    };
    return aliases[compact] ?? compact;
  }

  hasModule(moduleCode: string): boolean {
    if (!moduleCode?.trim()) return false;
    if (this.isSuperUser() || this.isPlatformSuperUser()) return true;

    const licensed = this.licensedModules();
    if (licensed !== null && licensed.length === 0) return false;

    const normalizedTarget = this.normalizeModuleCode(moduleCode);
    const userMods = this.allowedModules().map(m => this.normalizeModuleCode(m));

    if (userMods.length === 0) return false;

    if (licensed !== null) {
      const licensedNorm = licensed.map(m => this.normalizeModuleCode(m));
      if (!licensedNorm.includes('*') && !licensedNorm.includes(normalizedTarget)) {
        return false;
      }
    } else if (userMods.includes('*')) {
      return false;
    }

    if (userMods.includes('*') || userMods.includes(normalizedTarget)) return true;
    return this.moduleAccessService.hasModule(moduleCode);
  }

  hasModuleAccess(requiredModule: string): boolean {
    return this.hasModule(requiredModule);
  }

  hasLicensedModule(moduleCode: string): boolean {
    if (!moduleCode?.trim()) return false;
    const licensed = this.licensedModules();
    if (licensed === null) return false;
    const normalized = this.normalizeModuleList(licensed);
    return normalized.includes('*') || normalized.includes(this.normalizeModuleCode(moduleCode));
  }

  hasAnyModuleAccess(): boolean {
    const licensed = this.licensedModules();
    if (licensed === null) return false;
    const assignedModules = this.normalizeModuleList(this.allowedModules());
    const licensedModules = this.normalizeModuleList(licensed);
    if (!assignedModules.length || !licensedModules.length) return false;
    if (assignedModules.includes('*')) return true;
    if (licensedModules.includes('*')) return true;
    return assignedModules.some((module) => licensedModules.includes(module));
  }

  refreshModuleEntitlements(silent = false): Promise<boolean> {
    if (this.moduleEntitlementRefresh) return this.moduleEntitlementRefresh;

    const wrappedRefresh = this.loadModuleEntitlements(silent).finally(() => {
      this.moduleEntitlementRefresh = null;
    });
    this.moduleEntitlementRefresh = wrappedRefresh;
    return wrappedRefresh;
  }

  fetchEffectiveModules(): Observable<string[]> {
    return from(this.loadModuleEntitlements(true)).pipe(
      map(() => this.moduleAccessService.allowedModulesSignal()),
      catchError(() => of(this.moduleAccessService.allowedModulesSignal()))
    );
  }

  private async loadModuleEntitlements(silent: boolean): Promise<boolean> {
    try {
      const response = await this.api.get<any, any>('/auth/me/modules');
      const payload = response?.data ?? response?.Data ?? response;
      const rawAssignedModules =
        payload?.assignedModules ?? payload?.AssignedModules ?? payload?.modules ?? payload?.Modules ?? payload?.allowedModules;
      const rawLicensedModules = payload?.licensedModules ?? payload?.LicensedModules ?? ['*'];

      if (rawAssignedModules === undefined || rawAssignedModules === null) {
        throw new Error('La API no devolvió los módulos asignados actuales del usuario.');
      }

      const assignedModules = this.normalizeModuleList(this.parseStringList(rawAssignedModules));
      const licensedModules = this.normalizeModuleList(this.parseStringList(rawLicensedModules));
      this.allowedModules.set(assignedModules);
      this.licensedModules.set(licensedModules);
      this.hasExplicitModuleClaims.set(true);
      this.currentUser.update((user) => user ? { ...user, allowedModules: assignedModules } : user);

      this.moduleAccessService.setAllowedModules(assignedModules);

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('allowedModules', JSON.stringify(assignedModules));
        sessionStorage.setItem('hasAllModules', JSON.stringify(assignedModules.includes('*')));
      }
      this.entitlementErrorNotified = false;
      return true;
    } catch (error) {
      this.licensedModules.set([]);
      if (!this.entitlementErrorNotified) {
        console.error('[AuthService] No se pudieron verificar los módulos efectivos.', error);
        if (!silent) {
          this.notificationService.error(
            'No se pudieron actualizar los módulos de la empresa. Contacta al administrador.',
          );
        }
        this.entitlementErrorNotified = true;
      }
      return false;
    }
  }

  private handleTokenResponse(tokens: any, preservePreviousModules = true) {
    const rawToken =
      tokens?.accessToken ||
      tokens?.AccessToken ||
      tokens?.token ||
      tokens?.Token ||
      tokens?.data?.accessToken ||
      tokens?.data?.AccessToken ||
      tokens?.data?.token;

    if (rawToken) {
      const decoded = this.decodeJwt(rawToken);
      if (decoded) {
        const previousModules = this.allowedModules();
        const hadExplicitModuleClaims = this.hasExplicitModuleClaims();
        const responseUser = tokens?.user ?? tokens?.User ?? tokens?.data?.user ?? tokens?.data?.User;
        this.licensedModules.set(null);
        this.applyDecodedToken(
          decoded,
          responseUser && typeof responseUser === 'object'
            ? responseUser as LoginResponseUser
            : undefined,
        );
        if (preservePreviousModules && !this.hasExplicitModuleClaims() && hadExplicitModuleClaims) {
          this.allowedModules.set(previousModules);
          this.currentUser.update((user) => user ? { ...user, allowedModules: previousModules } : user);
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem('allowedModules', JSON.stringify(previousModules));
            sessionStorage.setItem('hasAllModules', JSON.stringify(previousModules.includes('*')));
          }
          this.hasExplicitModuleClaims.set(true);
        }
      }
    }
  }

  async login(credentials: LoginRequestDto) {
    // Asegurar que el login no dependa de un token previo ni de un tenant previo
    this.clearSession();
    purgeTenantStorage();
    const tokens = await doLogin(
      this.api,
      credentials.email,
      credentials.password,
      credentials.deviceId || undefined,
    );
    const loginUser = (tokens as any)?.user || (tokens as any)?.User || (tokens as any)?.data?.user;
    if (loginUser) {
      const userModules = loginUser.allowedModules || loginUser.modules || [];
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('allowedModules', JSON.stringify(userModules));
        sessionStorage.setItem('hasAllModules', JSON.stringify(userModules.includes('*') || userModules.length === 0));
      }
      this.moduleAccessService.init(userModules);
    }
    this.handleTokenResponse(tokens);
    await this.refreshModuleEntitlements();
    return tokens;
  }

  applyTokenResponse(tokens: any) {
    const rawToken =
      tokens?.accessToken ||
      tokens?.AccessToken ||
      tokens?.token ||
      tokens?.data?.accessToken ||
      tokens?.data?.token;
    const rawRefresh =
      tokens?.refreshToken ||
      tokens?.RefreshToken ||
      tokens?.data?.refreshToken;

    if (rawToken) setAccessToken(rawToken);
    if (rawRefresh) setRefreshToken(rawRefresh);
    this.handleTokenResponse(tokens);
  }

  async refreshSession(): Promise<void> {
    try {
      const tokens = await doRefresh(this.api);
      if (tokens.accessToken) {
        this.handleTokenResponse(tokens, false);
        await this.refreshModuleEntitlements();
      } else {
        this.clearSession();
      }
    } catch (error) {
      console.error('[AuthService] No se pudo renovar la sesión ni sus permisos.', error);
      this.clearSession();
    }
  }

  async refreshPermissionsForUser(userId: number): Promise<boolean> {
    if (!Number.isInteger(userId) || this.currentUser()?.id !== userId) {
      return false;
    }

    await this.refreshSession();
    return true;
  }

  async getMe(): Promise<ApiResponse<any>> {
    try {
      const res = await this.api.get<any, any>('/auth/me');
      return { success: true, data: res?.data ?? res?.Data ?? res };
    } catch {
      try {
        const res2 = await this.api.get<any, any>('/Auth/me');
        return { success: true, data: res2?.data ?? res2?.Data ?? res2 };
      } catch (err: any) {
        return { success: false, message: err?.message || 'Error al obtener datos del usuario autenticado' };
      }
    }
  }

  async register(
    data: RegisterRequestDto,
  ): Promise<ApiResponse<UserResponseDto>> {
    const res = await this.api.post<any, UserResponseDto>(
      '/Auth/register',
      data,
    );
    return { success: true, data: res };
  }

  async getDevToken(
    companyId: number,
    userId?: number,
    email?: string,
  ): Promise<TokenResponseDto> {
    const tokens = await this.api.post<any, TokenResponseDto>('/Auth/dev/token', {
      companyId,
      userId,
      email,
    });
    this.applyTokenResponse(tokens);
    await this.refreshModuleEntitlements();
    return tokens;
  }

  logout() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const compId = this.companyId() || 'default';
      const queueKey = `cuadre_offline_queue_${compId}`;
      const conflictsKey = `cuadre_offline_conflicts_${compId}`;
      const rawQueue = localStorage.getItem(queueKey);
      const rawConflicts = localStorage.getItem(conflictsKey);
      const hasUnsynced = (rawQueue && rawQueue.length > 30) || (rawConflicts && rawConflicts.length > 30);
      if (hasUnsynced) {
        const proceed = window.confirm(
          'ATENCIÓN: Hay ventas o incidencias offline pendientes de sincronizar en esta terminal.\n\nLas ventas permanecerán guardadas y cifradas en este equipo, pero no se sincronizarán en la nube hasta que inicies sesión nuevamente con esta empresa.\n\n¿Deseas cerrar sesión de todos modos?'
        );
        if (!proceed) {
          return;
        }
      }
    }
    void clientLogout(this.api);
    this.clearSession();
    this.router.navigate(['/login']);
  }

  async revokeAllSessions(): Promise<void> {
    try {
      await this.api.post('/auth/revoke-all', {});
    } catch {
      // ignore
    }
    this.logout();
  }

  clearSession() {
    this.currentUser.set(null);
    this.currentRole.set(null);
    this.companyId.set(null);
    this.userPermissions.set([]);
    this.allowedModules.set([]);
    this.hasExplicitModuleClaims.set(false);
    this.isPlatformSuperUser.set(false);
    this.licensedModules.set(null);
    this.isAuthenticated.set(false);
    setAccessToken(null);
    setRefreshToken(null);
    setCompanyId(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(API_CONSTANTS.COMPANY_ID_KEY);
      localStorage.removeItem(API_CONSTANTS.AUTH_TOKEN_KEY);
      localStorage.removeItem(API_CONSTANTS.AUTH_REFRESH_TOKEN_KEY);
      localStorage.removeItem('companyId');
      localStorage.removeItem('auth_company_id');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('auth_refresh_token');
      localStorage.removeItem('cuadre_access_token');
      localStorage.removeItem('cuadre_refresh_token');
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('allowedModules');
      sessionStorage.removeItem('hasAllModules');
      sessionStorage.removeItem('companyId');
      sessionStorage.removeItem('auth_company_id');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('auth_token');
    }
    this.moduleAccessService.init([]);
  }

  hasRole(roles: string[]): boolean {
    const userRole = this.currentRole();
    return userRole ? roles.map((r) => r.toLowerCase()).includes(userRole.toLowerCase()) : false;
  }

  isSuperUser(): boolean {
    const role = (this.currentRole() || '').toLowerCase();
    return role === 'admin' || role === 'superuser' || role === 'superadmin' || role === 'sysadmin';
  }
}
