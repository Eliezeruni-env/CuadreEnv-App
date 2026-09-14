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
  sub?: string; // userId
  name?: string;
  fullName?: string;
  role?: string;
  roles?: string[] | string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string | string[];
  companyId?: string | number;
  CompanyId?: string | number;
  isSuperUser?: boolean;
  exp?: number;
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
  isAuthenticated = signal<boolean>(false);
  isInitializing = signal<boolean>(true);

  constructor() {
    this.initializeSession();
  }

  private async initializeSession() {
    const rt = getRefreshToken();
    if (rt) {
      try {
        const tokens = await doRefresh(this.api);
        this.handleTokenResponse(tokens);
      } catch (e) {
        setAccessToken(null);
        setRefreshToken(null);
        this.clearSession();
      }
    } else {
      const at = getAccessToken();
      if (at) {
        const decoded = this.decodeJwt(at);
        if (decoded && (!decoded.exp || decoded.exp * 1000 > Date.now())) {
          this.applyDecodedToken(decoded);
        } else {
          this.clearSession();
        }
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const storedCompId = localStorage.getItem(API_CONSTANTS.COMPANY_ID_KEY);
      if (storedCompId && !this.companyId()) {
        const parsed = parseInt(storedCompId, 10);
        if (!isNaN(parsed)) {
          this.companyId.set(parsed);
        }
      }
    }

    this.isInitializing.set(false);
  }

  private decodeJwt(token: string): DecodedToken | null {
    try {
      const base64Url = token.split('.')[1];
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
    const email = decoded.email || decoded.sub || '';
    const id = decoded.sub ? parseInt(decoded.sub, 10) : 0;
    const fullName = decoded.name || decoded.fullName;
    
    let rawRole =
      decoded.role ||
      decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      null;

    if (Array.isArray(rawRole)) {
      rawRole = rawRole[0] || null;
    }

    const rawCompanyId = decoded.companyId || decoded.CompanyId;
    const compId = rawCompanyId
      ? parseInt(rawCompanyId.toString(), 10)
      : null;

    this.currentUser.set({ email, id, fullName });
    this.currentRole.set(rawRole);
    this.companyId.set(compId);
    this.isAuthenticated.set(true);

    if (typeof window !== 'undefined' && window.localStorage) {
      if (compId) {
        localStorage.setItem(API_CONSTANTS.COMPANY_ID_KEY, String(compId));
      } else {
        localStorage.removeItem(API_CONSTANTS.COMPANY_ID_KEY);
      }
    }
  }

  private handleTokenResponse(tokens: TokenResponseDto) {
    const decoded = this.decodeJwt(tokens.accessToken);
    if (decoded) {
      this.applyDecodedToken(decoded);
    }
  }

  async login(credentials: LoginRequestDto) {
    const tokens = await doLogin(
      this.api,
      credentials.email,
      credentials.password,
      credentials.deviceId || undefined,
    );
    this.handleTokenResponse(tokens);
    return tokens;
  }

  applyTokenResponse(tokens: TokenResponseDto) {
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    this.handleTokenResponse(tokens);
  }

  async refreshSession(): Promise<void> {
    const tokens = await doRefresh(this.api);
    this.handleTokenResponse(tokens);
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
    void clientLogout(this.api);
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private clearSession() {
    this.currentUser.set(null);
    this.currentRole.set(null);
    this.companyId.set(null);
    this.isAuthenticated.set(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(API_CONSTANTS.COMPANY_ID_KEY);
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
