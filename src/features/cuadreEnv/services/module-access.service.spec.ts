import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleAccessService } from './module-access.service';

describe('ModuleAccessService', () => {
  let service: ModuleAccessService;

  beforeEach(() => {
    service = new ModuleAccessService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return false if no modules are assigned', () => {
    service.init([]);
    expect(service.hasModule('sales')).toBe(false);
    expect(service.hasModule('dashboard')).toBe(false);
  });

  it('should grant access to all modules when allowedModules includes "*"', () => {
    service.init(['*']);
    expect(service.hasModule('sales')).toBe(true);
    expect(service.hasModule('cash-register')).toBe(true);
    expect(service.hasModule('random-module')).toBe(true);
    expect(service.hasAllModules).toBe(true);
  });

  it('should grant access to exact assigned modules', () => {
    service.init(['sales', 'cash-register']);
    expect(service.hasModule('sales')).toBe(true);
    expect(service.hasModule('cash-register')).toBe(true);
    expect(service.hasModule('customers')).toBe(false);
  });

  it('should resolve equivalent IDs and canonical moduleCodes', () => {
    service.init(['cash-register', 'inventory-stock', 'fraud-guardian']);
    expect(service.hasModule('cashregister')).toBe(true);
    expect(service.hasModule('inventory')).toBe(true);
    expect(service.hasModule('audit')).toBe(true);

    service.init(['sales']);
    expect(service.hasModule('mobile-pos')).toBe(true);
  });

  it('should allow dashboard if at least one module is assigned', () => {
    service.init(['sales']);
    expect(service.hasModule('dashboard')).toBe(true);
  });

  it('should allow profile for any authenticated user', () => {
    service.init(['sales']);
    expect(service.hasModule('profile')).toBe(true);
  });

  it('should persist modules to sessionStorage when available', () => {
    const mockStorage: Record<string, string> = {};
    const fakeStorage = {
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      getItem: (k: string) => mockStorage[k] || null,
    };
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.sessionStorage = fakeStorage;
    (globalThis as any).sessionStorage = fakeStorage;

    service.init(['sales', 'customers']);
    expect(fakeStorage.getItem('allowedModules')).toBe(JSON.stringify(['sales', 'customers']));
  });
});
