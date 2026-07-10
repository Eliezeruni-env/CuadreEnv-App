import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import api, { doLogin, doRefresh, logout as clientLogout, getAccessToken, getRefreshToken } from './apiClient';
import type { LoginRequestDto, RegisterRequestDto, TokenResponseDto, UserResponseDto, ApiResponse } from '../models/api';

interface DecodedToken {
  email?: string;
  sub?: string; // userId
  role?: string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string;
  companyId?: string | number;
  CompanyId?: string | number;
  exp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  currentUser = signal<{ email: string; id: number } | null>(null);
  currentRole = signal<string | null>(null);
  companyId = signal<number | null>(null);
  isAuthenticated = signal<boolean>(false);
  isInitializing = signal<boolean>(true);

  constructor(private router: Router) {
    this.initializeSession();
  }

  private async initializeSession() {
    const rt = getRefreshToken();
    if (rt) {
      try {
        const tokens = await doRefresh();
        this.handleTokenResponse(tokens);
      } catch (e) {
        this.clearSession();
      }
    }
    this.isInitializing.set(false);
  }

  private decodeJwt(token: string): DecodedToken | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window.atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  private handleTokenResponse(tokens: TokenResponseDto) {
    const decoded = this.decodeJwt(tokens.accessToken);
    if (decoded) {
      const email = decoded.email || decoded.sub || '';
      const id = decoded.sub ? parseInt(decoded.sub, 10) : 0;
      const role = decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || null;
      const rawCompanyId = decoded.companyId || decoded.CompanyId;
      const compId = rawCompanyId ? parseInt(rawCompanyId.toString(), 10) : null;

      this.currentUser.set({ email, id });
      this.currentRole.set(role);
      this.companyId.set(compId);
      this.isAuthenticated.set(true);
    }
  }

  async login(credentials: LoginRequestDto) {
    const tokens = await doLogin(credentials.email, credentials.password, credentials.deviceId || undefined);
    this.handleTokenResponse(tokens);
    return tokens;
  }

  async register(data: RegisterRequestDto): Promise<ApiResponse<UserResponseDto>> {
    const res = await api.post<ApiResponse<UserResponseDto>>('/auth/register', data);
    return res.data;
  }

  logout() {
    clientLogout();
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private clearSession() {
    this.currentUser.set(null);
    this.currentRole.set(null);
    this.companyId.set(null);
    this.isAuthenticated.set(false);
  }

  hasRole(roles: string[]): boolean {
    const userRole = this.currentRole();
    return userRole ? roles.includes(userRole) : false;
  }
}
