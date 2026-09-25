import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthInterceptor } from './authInterceptor';
import { API_CONSTANTS } from '../constants';

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;
  let mockHandler: any;

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    mockHandler = {
      handle: vi.fn().mockReturnValue(of({ status: 200 })),
    };
    interceptor = new AuthInterceptor();
  });

  it('should inject Authorization: Bearer <token> and X-Company-Id headers when present in localStorage', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(API_CONSTANTS.AUTH_TOKEN_KEY, 'my-test-jwt-token');
      window.localStorage.setItem(API_CONSTANTS.COMPANY_ID_KEY, '42');
    }

    const req = new HttpRequest('GET', '/v1/users');
    interceptor.intercept(req, mockHandler);

    expect(mockHandler.handle).toHaveBeenCalled();
    const interceptedReq: HttpRequest<any> = mockHandler.handle.mock.calls[0][0];
    expect(interceptedReq.headers.get('Authorization')).toBe('Bearer my-test-jwt-token');
    expect(interceptedReq.headers.get('X-Company-Id')).toBe('42');
  });

  it('should not inject Authorization header if no token is present', () => {
    const req = new HttpRequest('GET', '/v1/users');
    interceptor.intercept(req, mockHandler);

    expect(mockHandler.handle).toHaveBeenCalled();
    const interceptedReq: HttpRequest<any> = mockHandler.handle.mock.calls[0][0];
    expect(interceptedReq.headers.has('Authorization')).toBe(false);
  });

  it('should propagate errors from downstream handlers without suppressing them', async () => {
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
  });
});
