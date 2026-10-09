import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpInterceptorFn,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { getAccessToken, getCompanyId } from '../../features/cuadreEnv/services/apiClient';

/**
 * Agrega automáticamente el encabezado Authorization: Bearer <jwt>.
 * Garantiza que NO se envíe companyId en el body para determinar el tenant,
 * ya que el backend obtiene la compañía del claim companyId del JWT.
 * Agrega X-Company-Id para compatibilidad sólo en peticiones autenticadas.
 */
function isPublicAuthEndpoint(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('/auth/login') ||
    lower.includes('/auth/register') ||
    lower.includes('/auth/refresh') ||
    lower.includes('/hc')
  );
}

export const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  const token = getAccessToken();
  const companyId = getCompanyId();
  const isAuth = isPublicAuthEndpoint(req.url);

  let headers = req.headers;
  if (!isAuth && token && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  if (!isAuth && companyId && !headers.has('X-Company-Id')) {
    headers = headers.set('X-Company-Id', String(companyId));
  }

  if (
    !headers.has('Content-Type') &&
    !(req.body instanceof FormData) &&
    !(req.body instanceof Blob) &&
    req.method !== 'GET' &&
    req.method !== 'DELETE'
  ) {
    headers = headers.set('Content-Type', 'application/json');
  }

  // Prevenir que companyId sea enviado en el body para determinar tenant
  let body = req.body;
  if (
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    !(body instanceof FormData) &&
    !(body instanceof Blob)
  ) {
    if ('companyId' in body || 'CompanyId' in body) {
      // Excluir companyId del body para que el tenant provenga exclusivamente del JWT
      const { companyId: _c, CompanyId: _C, ...rest } = body as Record<string, any>;
      body = rest;
    }
  }

  const authReq = req.clone({
    headers,
    body,
    withCredentials: req.withCredentials !== undefined ? req.withCredentials : true,
  });
  return next(authReq);
};

export const authInterceptor = authInterceptorFn;

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    const token = getAccessToken();
    const companyId = getCompanyId();
    const isAuth = isPublicAuthEndpoint(req.url);

    let headers = req.headers;
    if (!isAuth && token && !headers.has('Authorization')) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    if (!isAuth && companyId && !headers.has('X-Company-Id')) {
      headers = headers.set('X-Company-Id', String(companyId));
    }

    if (
      !headers.has('Content-Type') &&
      !(req.body instanceof FormData) &&
      !(req.body instanceof Blob) &&
      req.method !== 'GET' &&
      req.method !== 'DELETE'
    ) {
      headers = headers.set('Content-Type', 'application/json');
    }

    let body = req.body;
    if (
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      !(body instanceof FormData) &&
      !(body instanceof Blob)
    ) {
      if ('companyId' in body || 'CompanyId' in body) {
        const { companyId: _c, CompanyId: _C, ...rest } = body as Record<string, any>;
        body = rest;
      }
    }

    const authReq = req.clone({
      headers,
      body,
      withCredentials: req.withCredentials !== undefined ? req.withCredentials : true,
    });
    return next.handle(authReq);
  }
}
