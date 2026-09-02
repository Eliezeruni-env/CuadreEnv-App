import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpInterceptorFn,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONSTANTS } from '../constants';

export const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;
  let companyId: string | null = null;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      token = window.localStorage.getItem(API_CONSTANTS.AUTH_TOKEN_KEY);
      companyId = window.localStorage.getItem(API_CONSTANTS.COMPANY_ID_KEY);
    } catch {
      // ignore
    }
  }

  let headers = req.headers;
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  if (companyId) {
    headers = headers.set('X-Company-Id', companyId);
  }

  const authReq = req.clone({ headers });
  return next(authReq);
};

export const authInterceptor = authInterceptorFn;

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    let token: string | null = null;
    let companyId: string | null = null;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        token = window.localStorage.getItem(API_CONSTANTS.AUTH_TOKEN_KEY);
        companyId = window.localStorage.getItem(API_CONSTANTS.COMPANY_ID_KEY);
      } catch {
        // ignore
      }
    }

    let headers = req.headers;
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    if (companyId) {
      headers = headers.set('X-Company-Id', companyId);
    }

    const authReq = req.clone({ headers });
    return next.handle(authReq);
  }
}
