import '@angular/compiler';
import { describe, it, expect, afterEach } from 'vitest';
import {
  API_BASE_URL,
  unwrap,
  setAccessToken,
  getAccessToken,
  extractArray,
} from './apiClient';

describe('ApiClient Central HTTP & /v1 configuration', () => {
  afterEach(() => {
    setAccessToken(null);
  });

  it('should use the Angular API base URL', () => {
    expect(API_BASE_URL).toBe('http://localhost:5160');
  });

  it('should store and retrieve access token for Authorization header', () => {
    setAccessToken('test-token-123');
    expect(getAccessToken()).toEqual('test-token-123');
  });

  describe('unwrap function', () => {
    it('should unwrap payload from ApiResponse<T> when success is true', () => {
      const apiResponse = {
        success: true,
        data: { id: 10, name: 'Acme Corp' },
        message: 'Success',
      };
      const result = unwrap(apiResponse);
      expect(result).toEqual({ id: 10, name: 'Acme Corp' });
    });

    it('should throw error with message and errors when ApiResponse success is false', () => {
      const apiResponse = {
        success: false,
        data: null,
        message: 'Invalid payload',
        errors: ['Field X is required'],
      };
      expect(() => unwrap(apiResponse)).toThrowError('Invalid payload');
      try {
        unwrap(apiResponse);
      } catch (err: any) {
        expect(err.errors).toEqual(['Field X is required']);
      }
    });

    it('should return raw DTO as-is when body is not an ApiResponse wrapper (e.g. /companysettings)', () => {
      const rawDto = {
        companyId: 1,
        theme: 'dark',
        maxUsers: 50,
      };
      const result = unwrap(rawDto);
      expect(result).toEqual(rawDto);
    });
  });

  describe('extractArray function', () => {
    it('should extract array from wrapped ApiResponse', () => {
      const response = {
        success: true,
        data: [{ id: 1 }, { id: 2 }],
      };
      expect(extractArray(response)).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should return direct array as-is', () => {
      expect(extractArray([{ id: 1 }])).toEqual([{ id: 1 }]);
    });

    it('should return empty array for null or undefined', () => {
      expect(extractArray(null)).toEqual([]);
    });
  });
});
