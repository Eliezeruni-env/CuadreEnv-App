import '@angular/compiler';
import { runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleAccessService } from '../../features/cuadreEnv/services/module-access.service';
import { moduleGuard } from './auth.guard';

function createMockInjector(providers: Map<any, any>) {
  return {
    get(token: any, notFoundValue?: any) {
      if (providers.has(token)) {
        return providers.get(token);
      }
      return notFoundValue;
    },
  } as any;
}

describe('moduleGuard', () => {
  let mockModuleAccess: { hasModule: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockModuleAccess = { hasModule: vi.fn() };
    mockRouter = { navigate: vi.fn() };
  });

  it('allows navigation when user has module access using moduleGuard("sales")', () => {
    mockModuleAccess.hasModule.mockReturnValue(true);
    const providers = new Map<any, any>();
    providers.set(ModuleAccessService, mockModuleAccess);
    providers.set(Router, mockRouter);
    const injector = createMockInjector(providers);

    const guardFn = moduleGuard('sales');
    const result = runInInjectionContext(injector, () => (guardFn as any)());

    expect(result).toBe(true);
    expect(mockModuleAccess.hasModule).toHaveBeenCalledWith('sales');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /dashboard with error=no-access when access is denied', () => {
    mockModuleAccess.hasModule.mockReturnValue(false);
    const providers = new Map<any, any>();
    providers.set(ModuleAccessService, mockModuleAccess);
    providers.set(Router, mockRouter);
    const injector = createMockInjector(providers);

    const guardFn = moduleGuard('billing');
    const result = runInInjectionContext(injector, () => (guardFn as any)());

    expect(result).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], {
      queryParams: { error: 'no-access', module: 'billing' },
    });
  });
});
