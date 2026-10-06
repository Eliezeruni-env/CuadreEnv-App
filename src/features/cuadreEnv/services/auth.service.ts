import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
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
} from './apiClient';
import type {
  LoginRequestDto,
  RegisterRequestDto,
  TokenResponseDto,
  UserResponseDto,
  ApiResponse,
} from '../types/api';
import { API_CONSTANTS } from '../../../app/constants';

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
  isSuperUser?: boolean;
  IsSuperUser?: boolean;
  is_superuser?: boolean;
  exp?: number;
  permissions?: string[] | string;
  Permissions?: string[] | string;
  permission?: string[] | string;
  modules?: string[] | string;
  Modules?: string[] | string;
  allowed_modules?: string[] | string;
  allowedModules?: string[] | string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);

  currentUser = signal<{ email: string; id: number; fullName?: string } | null>(null);
  currentRole = signal<string | null>(null);
  currentRoles = computed<string[]>(() => {
    const r = this.currentRole();
    return r ? [r] : [];
  });
  companyId = signal<number | null>(null);
  userPermissions = signal<string[]>([]);
  allowedModules = signal<string[]>([]);
  isAuthenticated = signal<boolean>(false);
  isInitializing = signal<boolean>(true);

  constructor() {
    this.initializeSession();
  }

  private async initializeSession() {
    const at = getAccessToken();
    if (at) {
      const decoded = this.decodeJwt(at);
      if (decoded && (!decoded.exp || decoded.exp * 1000 > Date.now())) {
        this.applyDecodedToken(decoded);
      }
    }

    const rt = getRefreshToken();
    if (rt && !this.isAuthenticated()) {
      try {
        const tokens = await doRefresh(this.api);
        if (tokens?.accessToken) {
          this.handleTokenResponse(tokens);
        }
      } catch {
        if (!this.isAuthenticated()) {
          this.clearSession();
        }
      }
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

  private applyDecodedToken(decoded: DecodedToken) {
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

    this.currentUser.set({ email, id, fullName });
    this.currentRole.set(rawRole);
    this.companyId.set(compId);

    // Extraer permisos asignados desde el JWT emitido por USM/Backend
    const rawPermissions =
      decoded.permissions ??
      decoded.Permissions ??
      decoded.permission ??
      decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/userdata'] ??
      [];
    let parsedPermissions: string[] = [];
    if (Array.isArray(rawPermissions)) {
      parsedPermissions = rawPermissions.map(String);
    } else if (typeof rawPermissions === 'string') {
      try {
        const json = JSON.parse(rawPermissions);
        parsedPermissions = Array.isArray(json) ? json.map(String) : [rawPermissions];
      } catch {
        parsedPermissions = rawPermissions.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    // Extraer módulos permitidos definidos para este rol en USM
    const rawModules =
      decoded.modules ??
      decoded.Modules ??
      decoded.allowed_modules ??
      decoded.allowedModules ??
      [];
    let parsedModules: string[] = [];
    if (Array.isArray(rawModules)) {
      parsedModules = rawModules.map(String);
    } else if (typeof rawModules === 'string') {
      try {
        const json = JSON.parse(rawModules);
        parsedModules = Array.isArray(json) ? json.map(String) : [rawModules];
      } catch {
        parsedModules = rawModules.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    this.userPermissions.set(parsedPermissions);
    this.allowedModules.set(parsedModules);
    this.isAuthenticated.set(true);

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

  private handleTokenResponse(tokens: any) {
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
        this.applyDecodedToken(decoded);
      }
    }
  }

  async login(credentials: LoginRequestDto) {
    // Asegurar que el login no dependa de un token previo ni de un tenant previo
    this.clearSession();
    const tokens = await doLogin(
      this.api,
      credentials.email,
      credentials.password,
      credentials.deviceId || undefined,
    );
    this.handleTokenResponse(tokens);
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
        this.handleTokenResponse(tokens);
      } else {
        this.clearSession();
      }
    } catch {
      this.clearSession();
    }
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
      sessionStorage.removeItem('companyId');
      sessionStorage.removeItem('auth_company_id');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('auth_token');
    }
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
