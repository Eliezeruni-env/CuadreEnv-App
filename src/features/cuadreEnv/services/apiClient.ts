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

let accessToken: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<TokenResponseDto> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('accessToken', token);
    else localStorage.removeItem('accessToken');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  return typeof window !== 'undefined'
    ? localStorage.getItem('accessToken')
    : null;
}

export function getRefreshToken(): string | null {
  return typeof window !== 'undefined'
    ? localStorage.getItem('refreshToken')
    : null;
}

export function setRefreshToken(token?: string | null) {
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('refreshToken', token);
    else localStorage.removeItem('refreshToken');
  }
}

export function unwrap<T = any>(body: any): T {
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    if (body.success) return body.data as T;
    const error: any = new Error(body.message || 'API error');
    error.errors = body.errors;
    throw error;
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
    const token = getAccessToken();
    const correlationId = generateCorrelationId();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-ID': correlationId,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const rawParams = options.params || {};
    const cleanParams: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawParams)) {
      if (value !== null && value !== undefined && value !== '' && value !== 'null') {
        cleanParams[key] = value;
      }
    }
    const params = new HttpParams({ fromObject: cleanParams });
    debugLog(`Outgoing request: [${method}] ${url}`);

    try {
      const body = await firstValueFrom(
        this.http.request<T>(method, `${environment.apiUrl}${url}`, {
          body: options.body,
          headers,
          params,
        }),
      );
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

      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !retry &&
        !url.toLowerCase().includes('/auth/')
      ) {
        try {
          await this.refreshWithLock();
          return this.request<T, R>(method, url, options, true);
        } catch (refreshError) {
          logout();
          if (
            typeof window !== 'undefined' &&
            !window.location.href.includes('/login')
          ) {
            window.location.href = '/login?expired=true';
          }
          throw refreshError;
        }
      }
      if (error instanceof HttpErrorResponse && error.status === 403)
        console.error('[SaaS-Security] Forbidden access (403)');
      if (error instanceof HttpErrorResponse && error.status === 404)
        console.warn(`[SaaS-API] Resource not found (404) on URL: ${url}`);
      handleMissingCompanyClaim(
        error instanceof HttpErrorResponse ? error.error : null,
      );
      throw error;
    }
  }

  private refreshWithLock(): Promise<TokenResponseDto> {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = doRefresh(this).finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }
    return refreshPromise!;
  }
}

function logRequestError(method: string, url: string, error: any, mapped?: MappedApiError) {
  const details = {
    method,
    url,
    status: error?.status || mapped?.statusCode,
    errorCode: mapped?.errorCode,
    requestId: mapped?.requestId,
    timestamp: mapped?.timestamp || new Date().toISOString(),
    message: mapped?.message || error?.message,
    body: error?.error,
  };
  try {
    console.error(
      '[SaaS-API] Request failed:',
      JSON.stringify(details, null, 2),
    );
  } catch {
    console.error('[SaaS-API] Request failed:', String(error));
  }
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
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  const body = await client.post<any, TokenResponseDto>('/Auth/refresh', {
    refreshToken,
  });
  setAccessToken(body.accessToken);
  setRefreshToken(body.refreshToken);
  return body;
}

export async function logout(client?: ApiClientService) {
  const refreshToken = getRefreshToken();
  setAccessToken(null);
  setRefreshToken(null);
  if (client && refreshToken) {
    await client.post('/Auth/revoke', { refreshToken }).catch(() => {});
  }
}

export function extractArray<T>(resData: any): T[] {
  if (!resData) return [];
  if (resData.success && resData.data !== undefined)
    return extractArray<T>(resData.data);
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData.items)) return resData.items;
  return [];
}
