import axios from "axios";
import type { TokenResponseDto } from "../types/api";
import { environment } from "../../../environments/environment";

// Environment-based configuration
const BASE_URL = 
  (typeof window !== "undefined" && (window as any).API_BASE_URL) || 
  environment.apiUrl;

// Debug logging helper
function debugLog(message: string, ...params: any[]) {
  if (typeof window !== 'undefined' && localStorage.getItem('debugMode') === 'true') {
    console.log(`[SaaS-API] ${message}`, ...params);
  }
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000 // 10s request timeout for resilience
});

let accessToken: string | null = null;
export function setAccessToken(token: string | null) { 
  accessToken = token; 
  debugLog("Access token updated in memory");
}
export function getAccessToken() { return accessToken; }

export function getRefreshToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("refreshToken");
  }
  return null;
}
export function setRefreshToken(rt?: string | null) {
  if (typeof window !== "undefined") {
    if (!rt) {
      localStorage.removeItem("refreshToken");
      debugLog("Refresh token removed from storage");
    } else {
      localStorage.setItem("refreshToken", rt);
      debugLog("Refresh token saved to storage");
    }
  }
}

// Auth helper
export async function doLogin(email: string, password: string, deviceId?: string) {
  debugLog(`Attempting login for: ${email}`);
  const res = await api.post<TokenResponseDto>("/auth/login", { email, password, deviceId });
  const body = res.data;
  setAccessToken(body.accessToken);
  setRefreshToken(body.refreshToken);
  return body;
}

export async function doRefresh() {
  debugLog("Refreshing session token...");
  const rt = getRefreshToken();
  if (!rt) {
    debugLog("Refresh token missing, cannot refresh session");
    throw new Error("No refresh token");
  }
  const res = await api.post<TokenResponseDto>("/auth/refresh", { refreshToken: rt });
  const body = res.data;
  setAccessToken(body.accessToken);
  setRefreshToken(body.refreshToken);
  debugLog("Token refreshed successfully");
  return body;
}

export function logout() {
  debugLog("Logging out, clearing session...");
  const rt = getRefreshToken();
  setAccessToken(null);
  setRefreshToken(null);
  if (rt) {
    // best-effort: revoke current refresh token
    api.post("/auth/revoke", { refreshToken: rt }).catch(()=>{});
  }
}

// Request interceptor attaches Authorization header and logs requests
api.interceptors.request.use((cfg) => {
  debugLog(`Outgoing request: [${cfg.method?.toUpperCase()}] ${cfg.url}`);
  if (accessToken && cfg.headers) {
    cfg.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return cfg;
});

// Response interceptor: handles retries, token refresh, and global HTTP errors
let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

api.interceptors.response.use(
  (resp) => {
    debugLog(`Response success: [${resp.config.method?.toUpperCase()}] ${resp.config.url} - Status ${resp.status}`);
    
    // Check for success === false with MISSING_COMPANY_CLAIM
    const body = resp.data;
    if (body && body.success === false && (
      body.errors?.includes("MISSING_COMPANY_CLAIM") ||
      body.Errors?.includes("MISSING_COMPANY_CLAIM") ||
      body.message?.includes("CompanyId claim missing") ||
      body.Message?.includes("CompanyId claim missing")
    )) {
      console.warn("[SaaS-Auth] Missing company claim in response body. Redirecting to company creation.");
      if (typeof window !== "undefined" && !window.location.href.includes("/companies/create") && !window.location.href.includes("/login")) {
        window.location.href = "/companies/create";
      }
    }
    return resp;
  },
  async (error) => {
    // Check for MISSING_COMPANY_CLAIM error!
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      if (
        errorData.errors?.includes("MISSING_COMPANY_CLAIM") || 
        errorData.Errors?.includes("MISSING_COMPANY_CLAIM") ||
        errorData.message?.includes("CompanyId claim missing") ||
        errorData.Message?.includes("CompanyId claim missing")
      ) {
        console.warn("[SaaS-Auth] Missing company claim. Redirecting to company creation.");
        if (typeof window !== "undefined" && !window.location.href.includes("/companies/create") && !window.location.href.includes("/login")) {
          window.location.href = "/companies/create";
        }
        return Promise.reject(error);
      }
    }

    const originalReq = error.config;
    if (!originalReq) {
      return Promise.reject(error);
    }

    // 1. Session Expiry & Auto-Refresh handling on 401 Unauthorized
    if (error.response && error.response.status === 401 && !originalReq._retry) {
      originalReq._retry = true;
      debugLog("401 Unauthorized detected, starting refresh flow");
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = doRefresh().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }
      try {
        await refreshPromise;
        // After refresh, retry original request
        debugLog("Retrying original request after token refresh");
        return api(originalReq);
      } catch (e) {
        debugLog("Session refresh failed. Redirecting to login");
        logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login?expired=true";
        }
        return Promise.reject(e);
      }
    }

    // 2. Resilient Network / Timeout Retry Logic
    // If request fails due to network error or timeout (status is undefined or timeout error)
    const isNetworkError = !error.response;
    const isTimeout = error.code === 'ECONNABORTED';
    
    if ((isNetworkError || isTimeout) && (!originalReq._retryCount || originalReq._retryCount < 2)) {
      originalReq._retryCount = originalReq._retryCount || 0;
      originalReq._retryCount++;
      debugLog(`Network failure detected. Retrying request (${originalReq._retryCount}/2)...`, error.message);
      
      // Delay retry slightly (exponential backoff)
      const delay = originalReq._retryCount * 1500;
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalReq);
    }

    // 3. Global HTTP Error Logger / Formatter
    if (error.response) {
      const status = error.response.status;
      debugLog(`Request failed with status ${status}: [${originalReq.method?.toUpperCase()}] ${originalReq.url}`);
      
      if (status === 403) {
        console.error("[SaaS-Security] Forbidden access attempt blocked");
      } else if (status === 429) {
        console.warn("[SaaS-RateLimit] Requests are being rate limited by backend policies");
      } else if (status >= 500) {
        console.error(`[SaaS-ServerError] Internal Server Error on URL: ${originalReq.url}`);
      }
    } else {
      debugLog("Request failed with network issue: ", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;

export function extractArray<T>(resData: any): T[] {
  if (!resData) return [];
  // Case: Wrapped ApiResponse
  if (resData.success && resData.data !== undefined) {
    return extractArray<T>(resData.data);
  }
  // Case: Direct Array
  if (Array.isArray(resData)) {
    return resData;
  }
  // Case: Paginated Object
  if (resData && Array.isArray(resData.items)) {
    return resData.items;
  }
  return [];
}
