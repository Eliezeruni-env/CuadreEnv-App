import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { TokenResponseDto } from '../types/api';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';
import { mapApiErrorToUserMessage, MappedApiError } from '../utils/api-error-mapper';
import { logger } from './logger.service';

export const API_BASE_URL = environment.API_BASE_URL;

export type TelemetryErrorCallback = (errorData: {
  method: string;
  url: string;
  statusCode: number;
  errorCode?: string;
  requestId?: string;
  timestamp: string;
  rawError: any;
}) => void;

let customTelemetryHandler: TelemetryErrorCallback | null = null;

export function registerTelemetryHandler(handler: TelemetryErrorCallback) {
  customTelemetryHandler = handler;
}

function debugLog(message: string, ...params: any[]) {
  if (
    typeof window !== 'undefined' &&
    localStorage.getItem('debugMode') === 'true'
  ) {
    console.log(`[SaaS-API] ${message}`, ...params);
  }
}

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'fe-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

let currentSessionEpoch = 0;

export function getSessionEpoch(): number {
  return currentSessionEpoch;
}

export function invalidateSessionEpoch(): void {
  currentSessionEpoch++;
}

const PRESERVED_STORAGE_KEYS = new Set([
  'coreui-free-angular-admin-template-theme',
  'debugMode',
  'app_lang',
]);

export function purgeTenantStorage(): void {
  if (typeof window === 'undefined') return;

  // Invalidate any in-flight requests from the previous tenant/session
  currentSessionEpoch++;

  // 1. Purge all sessionStorage
  try {
    if (window.sessionStorage) {
      window.sessionStorage.clear();
    }
  } catch (e) {
    console.warn('[TenantIsolation] Could not clear sessionStorage:', e);
  }

  // 2. Purge all tenant/business data from localStorage, preserving only app preferences
  try {
    if (window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && !PRESERVED_STORAGE_KEYS.has(key)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn('[TenantIsolation] Could not clear localStorage:', e);
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      if (window.sessionStorage) {
        sessionStorage.setItem('accessToken', token);
        sessionStorage.setItem('auth_token', token);
      }
      if (window.localStorage) {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('auth_token', token);
      }
    } else {
      if (window.sessionStorage) {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('auth_token');
      }
      if (window.localStorage) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('auth_refresh_token');
      }
    }
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    return (
      (window.sessionStorage && (sessionStorage.getItem('accessToken') || sessionStorage.getItem('auth_token'))) ||
      (window.localStorage && (localStorage.getItem('accessToken') || localStorage.getItem('auth_token'))) ||
      null
    );
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('refreshToken') || localStorage.getItem('auth_refresh_token');
  }
  return null;
}

export function setRefreshToken(token?: string | null) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      localStorage.setItem('refreshToken', token);
      localStorage.setItem('auth_refresh_token', token);
    } else {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('auth_refresh_token');
    }
  }
}

export function unwrap<T = any>(body: any): T {
  if (body && typeof body === 'object') {
    if ('success' in body && 'data' in body) {
      if (body.success) return body.data as T;
      const error: any = new Error(body.message || 'API error');
      error.errors = body.errors;
      throw error;
    }
    if ('Success' in body && 'Data' in body) {
      if (body.Success) return body.Data as T;
      const error: any = new Error(body.Message || 'API error');
      error.errors = body.Errors;
      throw error;
    }
    if ('isSuccess' in body && 'value' in body) {
      if (body.isSuccess) return body.value as T;
      const error: any = new Error(body.error || 'API error');
      throw error;
    }
  }
  return body as T;
}

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private notificationService = inject(NotificationService, { optional: true });

  constructor(private readonly http: HttpClient) {}

  get<T = any, R = T>(
    url: string,
    options?: { params?: Record<string, any> },
  ): Promise<R> {
    return this.request<T, R>('GET', url, options);
  }

  post<T = any, R = T>(url: string, body?: any): Promise<R> {
    return this.request<T, R>('POST', url, { body });
  }

  put<T = any, R = T>(url: string, body?: any): Promise<R> {
    return this.request<T, R>('PUT', url, { body });
  }

  patch<T = any, R = T>(url: string, body?: any): Promise<R> {
    return this.request<T, R>('PATCH', url, { body });
  }

  delete<T = any, R = T>(url: string): Promise<R> {
    return this.request<T, R>('DELETE', url);
  }

  private async request<T, R>(
    method: string,
    url: string,
    options: { body?: any; params?: Record<string, any> } = {},
    retry = false,
  ): Promise<R> {
    const correlationId = generateCorrelationId();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-ID': correlationId,
    };
    
    const rawParams = options.params || {};
    const cleanParams: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawParams)) {
      if (value !== null && value !== undefined && value !== '' && value !== 'null') {
        cleanParams[key] = value;
      }
    }
    const params = new HttpParams({ fromObject: cleanParams });
    const requestEpoch = currentSessionEpoch;
    debugLog(`Outgoing request: [${method}] ${url}`);

    try {
      const body = await firstValueFrom(
        this.http.request<T>(method, `${environment.apiUrl}${url}`, {
          body: options.body,
          headers,
          params,
        }),
      );
      if (requestEpoch !== currentSessionEpoch) {
        debugLog(`[TenantIsolation] In-flight response discarded due to session/tenant change: [${method}] ${url}`);
        const cancelledError: any = new Error('Request discarded: session or tenant changed');
        cancelledError.isStaleSession = true;
        throw cancelledError;
      }
      return unwrap<R>(body);
    } catch (error: any) {
      const mapped = mapApiErrorToUserMessage(error);
      const statusCode = error instanceof HttpErrorResponse ? error.status : (mapped.statusCode || 0);

      // Enhance error object with mapped details for calling components
      if (error && typeof error === 'object') {
        error.mappedError = mapped;
        error.requestId = mapped.requestId;
        error.fieldErrors = mapped.fieldErrors;
      }

      logRequestError(method, url, error, mapped);

      // Telemetry dispatch on server errors (statusCode >= 500)
      if (statusCode >= 500) {
        dispatchTelemetry(method, url, statusCode, mapped, error);
      }

      // AuthInterceptor handles 401 and 403 globally
      throw error;
    }
  }
}

function logRequestError(method: string, url: string, error: any, mapped?: MappedApiError) {
  const status = error?.status || mapped?.statusCode || 0;
  const msg = mapped?.message || error?.message || 'Error de petición';
  logger.logApiError(method, url, status, msg, {
    errorCode: mapped?.errorCode,
    requestId: mapped?.requestId,
    body: error?.error,
  });
}

function dispatchTelemetry(
  method: string,
  url: string,
  statusCode: number,
  mapped: MappedApiError,
  rawError: any,
) {
  const telemetryData = {
    method,
    url,
    statusCode,
    errorCode: mapped.errorCode,
    requestId: mapped.requestId,
    timestamp: mapped.timestamp || new Date().toISOString(),
    rawError: rawError?.error || rawError?.message,
  };

  try {
    console.error('[SaaS-Telemetry] Error 500+ reported:', telemetryData);
    if (customTelemetryHandler) {
      customTelemetryHandler(telemetryData);
    }
  } catch (err) {
    console.warn('[SaaS-Telemetry] Failed to dispatch telemetry event:', err);
  }
}

function handleMissingCompanyClaim(body: any) {
  const missing =
    body?.errors?.includes?.('MISSING_COMPANY_CLAIM') ||
    body?.Errors?.includes?.('MISSING_COMPANY_CLAIM') ||
    body?.message?.includes?.('CompanyId claim missing') ||
    body?.Message?.includes?.('CompanyId claim missing');
  if (
    missing &&
    typeof window !== 'undefined' &&
    !window.location.href.includes('/companies/create') &&
    !window.location.href.includes('/login')
  ) {
    window.location.href = '/companies/create';
  }
}

export async function doLogin(
  client: ApiClientService,
  email: string,
  password: string,
  deviceId?: string,
) {
  const body = await client.post<any, TokenResponseDto>('/Auth/login', {
    email,
    password,
    deviceId,
  });
  setAccessToken(body.accessToken);
  setRefreshToken(body.refreshToken);
  return body;
}

export async function doRefresh(
  client: ApiClientService,
): Promise<TokenResponseDto> {
  const token = getAccessToken();
  return {
    accessToken: token || '',
    refreshToken: getRefreshToken() || '',
  };
}

export async function logout(_client?: ApiClientService) {
  setAccessToken(null);
  purgeTenantStorage();
}

export function extractArray<T>(resData: any): T[] {
  if (!resData) return [];
  if (resData.success && resData.data !== undefined)
    return extractArray<T>(resData.data);
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData.items)) return resData.items;
  return [];
}
