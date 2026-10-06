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
import { Router } from '@angular/router';
import { NotificationService } from '../../features/cuadreEnv/services/notification.service';
import { AuthService } from '../../features/cuadreEnv/services/auth.service';
import { setAccessToken, setRefreshToken } from '../../features/cuadreEnv/services/apiClient';

/**
 * Manejador global de códigos HTTP conforme a la especificación de CuadreEnv:
 * - 401: Limpiar sesión, redirigir al login y mostrar "La sesión expiró o no es válida".
 * - 403: Mostrar "No tienes permisos para realizar esta operación".
 * - 409: Mostrar el mensaje recibido desde la API (duplicados, conflictos o concurrencia).
 * - 422: Mostrar los errores de validación.
 * - 500: Mostrar mensaje genérico al usuario y registrar detalle técnico en el logger del frontend.
 */
export const appHttpInterceptorFn: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService, { optional: true });
  const router = inject(Router, { optional: true });
  const authService = inject(AuthService, { optional: true });

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      handleGlobalHttpError(error, req, notificationService, router, authService);
      return throwError(() => error);
    })
  );
};

export const appHttpInterceptor = appHttpInterceptorFn;

@Injectable()
export class AppHttpInterceptor implements HttpInterceptor {
  private readonly notificationService = inject(NotificationService, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly authService = inject(AuthService, { optional: true });

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        handleGlobalHttpError(error, req, this.notificationService, this.router, this.authService);
        return throwError(() => error);
      })
    );
  }
}

function handleGlobalHttpError(
  error: HttpErrorResponse,
  req: HttpRequest<any>,
  notificationService: NotificationService | null,
  router: Router | null,
  authService: AuthService | null
): void {
  const status = error.status;
  const isLoginRequest = req.url.toLowerCase().includes('/auth/login');

  // 1. Manejo Status 0: Falla de conexión con la API o error de CORS/red
  if (status === 0) {
    console.error('[API Network/CORS Error]', {
      url: req.urlWithParams || req.url,
      method: req.method,
      error,
    });
    if (notificationService) {
      notificationService.error(
        'No se pudo conectar con la API en http://localhost:8080/v1. Verifique que el backend esté disponible y los encabezados CORS estén autorizados.',
        'Falla de Conexión / CORS'
      );
    }
    return;
  }

  // 2. Manejo 400: Solicitud Inválida / Credenciales en Login
  if (status === 400) {
    if (isLoginRequest) {
      if (notificationService) {
        notificationService.error('Correo o contraseña incorrectos.', 'Acceso Inválido');
      }
      return;
    }

    const apiMsg =
      error.error?.message ||
      (typeof error.error === 'string' ? error.error : null) ||
      'Solicitud no procesable. Verifique los datos suministrados.';

    if (notificationService && req.method !== 'GET') {
      notificationService.warning(apiMsg, 'Solicitud Inválida');
    }
    return;
  }

  // 3. Manejo 401: No autorizado / Sesión expirada
  if (status === 401) {
    console.warn('[API 401 Unauthorized]', {
      url: req.urlWithParams || req.url,
      method: req.method,
      error: error.error,
    });
    if (isLoginRequest) {
      if (notificationService) {
        notificationService.error('Correo o contraseña incorrectos.', 'Acceso Inválido');
      }
      return;
    }

    setAccessToken(null);
    setRefreshToken(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('cuadre_access_token');
      localStorage.removeItem('cuadre_refresh_token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth_token');
    }

    if (authService) {
      authService.clearSession();
    }

    if (notificationService) {
      notificationService.error(
        'La sesión expiró o no es válida',
        'Sesión Expirada'
      );
    }

    if (router && !router.url.includes('/login')) {
      router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
    }
    return;
  }

  // 4. Manejo 403: Prohibido / Sin permisos suficientes
  if (status === 403) {
    console.warn('[API 403 Forbidden]', {
      url: req.urlWithParams || req.url,
      method: req.method,
      error: error.error,
    });
    if (notificationService) {
      notificationService.warning(
        'No tienes permisos para realizar esta operación',
        'Acceso Denegado (403)'
      );
    }
    return;
  }

  // Manejo 404: Recurso no encontrado
  if (status === 404) {
    console.warn('[API 404 Not Found]', {
      url: req.urlWithParams || req.url,
      method: req.method,
      error: error.error,
    });
    if (notificationService && req.method !== 'GET') {
      const notFoundMsg =
        error.error?.message ||
        (typeof error.error === 'string' ? error.error : null) ||
        'El recurso solicitado no fue encontrado en el servidor.';
      notificationService.warning(notFoundMsg, 'No Encontrado (404)');
    }
    return;
  }

  // 5. Manejo 409: Conflicto / Duplicado / Concurrencia
  if (status === 409) {
    const conflictMessage =
      error.error?.message ||
      (typeof error.error === 'string' ? error.error : null) ||
      'Se detectó un conflicto de concurrencia o un registro duplicado en el sistema.';

    if (notificationService) {
      notificationService.warning(conflictMessage, 'Conflicto');
    }
    return;
  }

  // 6. Manejo 422: Error de validación de entidad
  if (status === 422) {
    let validationDetails = '';
    if (error.error?.errors) {
      if (Array.isArray(error.error.errors)) {
        validationDetails = error.error.errors.join(' · ');
      } else if (typeof error.error.errors === 'object') {
        const errList: string[] = [];
        for (const [field, msgs] of Object.entries(error.error.errors)) {
          if (Array.isArray(msgs)) {
            errList.push(`${field}: ${msgs.join(', ')}`);
          } else if (typeof msgs === 'string') {
            errList.push(`${field}: ${msgs}`);
          }
        }
        validationDetails = errList.join(' · ');
      }
    }

    const message =
      validationDetails ||
      error.error?.message ||
      'Los datos suministrados no cumplen las reglas de validación requeridas.';

    if (notificationService) {
      notificationService.warning(message, 'Validación Requerida');
    }
    return;
  }

  // 7. Manejo 429: Demasiados intentos (Rate limit)
  if (status === 429) {
    if (notificationService) {
      notificationService.warning(
        'Demasiados intentos. Espera unos segundos e inténtalo nuevamente.',
        'Límite de Solicitudes'
      );
    }
    return;
  }

  // 8. Manejo 500: Error interno de servidor
  if (status >= 500) {
    const requestId =
      error.headers?.get('x-request-id') ||
      error.headers?.get('X-Request-Id') ||
      error.headers?.get('X-Correlation-ID') ||
      error.headers?.get('x-correlation-id') ||
      undefined;

    const fullUrl = error.url || req.urlWithParams || req.url;
    const currentUser = authService?.currentUser()?.email || 'unauthenticated';

    // Registrar detalle técnico ÚNICAMENTE en el logger del frontend
    console.error('[API 500 Internal Server Error]', {
      timestamp: new Date().toISOString(),
      url: fullUrl,
      method: req.method,
      status: error.status,
      statusText: error.statusText,
      responseBody: error.error,
      requestId,
      authenticatedUser: currentUser,
    });

    // Mostrar al usuario mensaje genérico amigable sin stack traces ni SQL
    if (notificationService) {
      notificationService.error(
        'Ocurrió un error interno. Intenta nuevamente.',
        'Error del Servidor',
        requestId
      );
    }
    return;
  }

  // Otros errores HTTP (ej. 404)
  if (notificationService && req.method !== 'GET') {
    const fallbackMsg =
      error.error?.message ||
      (typeof error.error === 'string' ? error.error : null) ||
      'Ocurrió un error al procesar la solicitud.';
    notificationService.error(fallbackMsg, 'Atención');
  }
}

