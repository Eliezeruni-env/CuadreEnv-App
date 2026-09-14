import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { NotificationService } from '../features/erp/services/notification.service';

import { Router } from '@angular/router';

export const appHttpInterceptorFn: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService, { optional: true });
  const router = inject(Router, { optional: true });

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Ocurrió un error inesperado al procesar la solicitud.';

      if (error.error instanceof ErrorEvent) {
        errorMessage = error.error.message;
      } else {
        if (error.status === 401) {
          errorMessage = 'Sesión expirada o no autorizada. Por favor inicie sesión nuevamente.';
          if (router && !router.url.includes('/login')) {
            router.navigate(['/login']);
          }
        } else if (error.status === 403) {
          errorMessage = 'No tiene permisos suficientes para realizar esta acción.';
        } else if (error.status === 404) {
          errorMessage = 'El recurso solicitado no fue encontrado.';
        } else if (error.status === 500) {
          errorMessage = 'Error interno del servidor. Por favor intente más tarde.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
      }

      const isMuted =
        req.headers.has('X-Silent-Error') ||
        (req.method === 'GET' &&
          (req.url.includes('/CashRegister') ||
            req.url.includes('/users') ||
            req.url.includes('/Warehouse') ||
            req.url.includes('/PurchaseOrderReceipt')));

      if (notificationService && error.status !== 401 && !isMuted) {
        notificationService.error(errorMessage);
      }

      return throwError(() => error);
    })
  );
};

export const appHttpInterceptor = appHttpInterceptorFn;

@Injectable()
export class AppHttpInterceptor implements HttpInterceptor {
  private readonly notificationService = inject(NotificationService, { optional: true });

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Ocurrió un error inesperado al procesar la solicitud.';

        if (error.error instanceof ErrorEvent) {
          errorMessage = error.error.message;
        } else {
          if (error.status === 401) {
            errorMessage = 'Sesión expirada o no autorizada. Por favor inicie sesión nuevamente.';
          } else if (error.status === 403) {
            errorMessage = 'No tiene permisos suficientes para realizar esta acción.';
          } else if (error.status === 404) {
            errorMessage = 'El recurso solicitado no fue encontrado.';
          } else if (error.status === 500) {
            errorMessage = 'Error interno del servidor. Por favor intente más tarde.';
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          }
        }

        const isMuted =
          req.headers.has('X-Silent-Error') ||
          (req.method === 'GET' && (req.url.includes('/CashRegister') || req.url.includes('/users')));

        if (this.notificationService && error.status !== 401 && !isMuted) {
          this.notificationService.error(errorMessage);
        }

        return throwError(() => error);
      })
    );
  }
}
