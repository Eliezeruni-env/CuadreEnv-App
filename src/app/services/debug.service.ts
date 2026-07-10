import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DebugService {
  private isDebugEnabled(): boolean {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('debugMode') === 'true';
    }
    return false;
  }

  log(message: string, ...optionalParams: any[]) {
    if (this.isDebugEnabled()) {
      console.log(`[SaaS-LOG] ${message}`, ...optionalParams);
    }
  }

  warn(message: string, ...optionalParams: any[]) {
    if (this.isDebugEnabled()) {
      console.warn(`[SaaS-WARN] ${message}`, ...optionalParams);
    }
  }

  error(message: string, ...optionalParams: any[]) {
    // Errors are always logged in console for production visibility, but formatted
    console.error(`[SaaS-ERROR] ${message}`, ...optionalParams);
  }
}
