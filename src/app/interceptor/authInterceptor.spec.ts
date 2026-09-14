import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthInterceptor, authInterceptorFn } from './authInterceptor';
import { setAccessToken } from '../../features/cuadreEnv/services/apiClient';

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;
  let mockHandler: any;
  let mockRouter: any;

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
    setAccessToken(null);

    mockRouter = {
      navigate: vi.fn(),
    };

    mockHandler = {
      handle: vi.fn().mockReturnValue(of({ status: 200 })),
    };
    interceptor = new AuthInterceptor(mockRouter);
  });

  it('should inject Authorization: Bearer <token> header when token is present in sessionStorage', () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('accessToken', 'my-test-jwt-token');
    }

    const req = new HttpRequest('GET', '/v1/users');
    interceptor.intercept(req, mockHandler);

    expect(mockHandler.handle).toHaveBeenCalled();
    const interceptedReq: HttpRequest<any> = mockHandler.handle.mock.calls[0][0];
    expect(interceptedReq.headers.get('Authorization')).toBe('Bearer my-test-jwt-token');
  });

  it('should not inject Authorization header if no token is present', () => {
    const req = new HttpRequest('GET', '/v1/users');
    interceptor.intercept(req, mockHandler);

    expect(mockHandler.handle).toHaveBeenCalled();
    const interceptedReq: HttpRequest<any> = mockHandler.handle.mock.calls[0][0];
    expect(interceptedReq.headers.has('Authorization')).toBe(false);
  });

  it('should propagate 401 error, redirect to /login and not return mock data', async () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('accessToken', 'expired-token');
    }

    const error401 = new HttpErrorResponse({
      status: 401,
      statusText: 'Unauthorized',
      error: { message: 'Token expired' },
    });
    mockHandler.handle.mockReturnValue(throwError(() => error401));

    const req = new HttpRequest('GET', '/v1/users');

    let receivedError: any;
    try {
      await new Promise((resolve, reject) => {
        interceptor.intercept(req, mockHandler).subscribe({
          next: resolve,
          error: reject,
        });
      });
    } catch (err) {
      receivedError = err;
    }

    expect(receivedError).toBeDefined();
    expect(receivedError.status).toBe(401);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { expired: 'true' },
    });
  });
});
