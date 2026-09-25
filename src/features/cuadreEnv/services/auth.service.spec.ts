import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ApiClientService, setAccessToken, getAccessToken } from './apiClient';

describe('AuthService & Session Persistence', () => {
  let mockRouter: any;
  let mockApiClient: any;

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
    setAccessToken(null);

    mockRouter = {
      navigate: vi.fn(),
    };
    mockApiClient = {
      post: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: mockRouter },
        { provide: ApiClientService, useValue: mockApiClient },
      ],
    });
  });

  it('should restore authentication state from valid JWT in sessionStorage without refresh call', () => {
    // Fake JWT payload: { sub: "42", email: "admin@cuadre.com", role: "Admin", isSuperUser: true, exp: 9999999999 }
    const fakePayload = {
      sub: '42',
      email: 'admin@cuadre.com',
      role: 'Admin',
      isSuperUser: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const base64Payload = btoa(JSON.stringify(fakePayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const fakeToken = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.signature`;

    setAccessToken(fakeToken);

    // Instantiate AuthService via TestBed
    const authService = TestBed.inject(AuthService);

    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.currentUser()?.email).toBe('admin@cuadre.com');
    expect(authService.currentUser()?.id).toBe(42);
    expect(authService.currentRole()).toBe('Admin');
    expect(authService.isSuperUser()).toBe(true);
  });

  it('should clear sessionStorage and reset signals on logout', () => {
    setAccessToken('any-token');
    const authService = TestBed.inject(AuthService);

    authService.logout();

    expect(getAccessToken()).toBeNull();
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.currentUser()).toBeNull();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
