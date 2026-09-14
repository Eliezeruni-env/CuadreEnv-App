import { Injectable, inject, signal } from '@angular/core';
import { ApiClientService } from '../../cuadreEnv/services/apiClient';
import type {
  Company,
  CompanySettingsDto,
  CreateCompanyRequest,
  TokenResponseDto,
  ApiResponse,
} from '../../cuadreEnv/types/api';

export interface CreateCompanyResult {
  company: Company;
  tokens?: TokenResponseDto;
}

const SETTINGS_STORAGE_KEY = 'cuadre_company_settings';

const DEFAULT_COMPANY_SETTINGS: CompanySettingsDto = {
  companyName: 'CuadreEnv Dominicana SRL',
  commercialName: 'CuadreEnv Soluciones',
  rnc: '1-01-00000-0',
  address: 'Av. Winston Churchill #1099, Santo Domingo, D.N.',
  phone: '(809) 555-0199',
  logoUrl: '',
  invoiceFooterPhrase: '¡Gracias por su preferencia! Garantía válida por 30 días con su comprobante.',
  currency: 'DOP',
  defaultTaxPercentage: 18,
};

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly api = inject(ApiClientService);

  readonly currentSettings = signal<CompanySettingsDto>(this.getInitialSettings());
  readonly activeCompanyId = signal<number | null>(this.getInitialCompanyId());

  private getInitialCompanyId(): number | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = window.sessionStorage.getItem('active_company_id');
        return stored ? parseInt(stored, 10) : null;
      }
    } catch {}
    return null;
  }

  setActiveCompany(companyId: number | null): void {
    this.activeCompanyId.set(companyId);
    try {
      if (typeof window !== 'undefined') {
        if (companyId) {
          window.sessionStorage?.setItem('active_company_id', String(companyId));
          window.sessionStorage?.setItem('auth_company_id', String(companyId));
        } else {
          window.sessionStorage?.removeItem('active_company_id');
          window.sessionStorage?.removeItem('auth_company_id');
        }
        window.sessionStorage?.removeItem(SETTINGS_STORAGE_KEY);
      }
    } catch {}
    this.getCompanySettings().catch(() => {});
  }

  clearState(): void {
    this.activeCompanyId.set(null);
    this.currentSettings.set(DEFAULT_COMPANY_SETTINGS);
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage?.removeItem('active_company_id');
        window.sessionStorage?.removeItem('auth_company_id');
        window.sessionStorage?.removeItem(SETTINGS_STORAGE_KEY);
        window.localStorage?.removeItem(SETTINGS_STORAGE_KEY);
      }
    } catch {}
  }

  private getInitialSettings(): CompanySettingsDto {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_COMPANY_SETTINGS;
  }

  async getCompanies(): Promise<ApiResponse<Company[]>> {
    const res = await this.api.get<any, any>('/Company');
    if (Array.isArray(res)) {
      return { success: true, data: res };
    }
    return res;
  }

  async getCompany(id: number): Promise<Company> {
    const res = await this.api.get<any, any>(`/Company/${id}`);
    if (res && typeof res === 'object') {
      if (res.id) return res as Company;
      if (res.data) return res.data as Company;
    }
    throw new Error('Unable to load company.');
  }

  async getCompanySettings(): Promise<CompanySettingsDto> {
    try {
      const res = await this.api.get<any, CompanySettingsDto>('/CompanySettings');
      if (res && typeof res === 'object') {
        const merged = { ...this.currentSettings(), ...res };
        this.saveToStorage(merged);
        this.currentSettings.set(merged);
        return merged;
      }
    } catch {
      // Return cached settings
    }
    return this.currentSettings();
  }

  async updateCompanySettings(settings: CompanySettingsDto): Promise<void> {
    const merged = { ...this.currentSettings(), ...settings };
    this.saveToStorage(merged);
    this.currentSettings.set(merged);

    try {
      await this.api.put('/CompanySettings', merged);
    } catch (err) {
      console.warn('Backend CompanySettings update fallback to local cache:', err);
    }
  }

  private saveToStorage(settings: CompanySettingsDto) {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }

  async createCompany(
    data: CreateCompanyRequest,
  ): Promise<CreateCompanyResult> {
    const payload = await this.api.post<any, any>('/Company', data);

    if (payload && payload.company) {
      return {
        company: payload.company as Company,
        tokens: payload.tokens as TokenResponseDto | undefined,
      };
    }

    if (payload && payload.id) {
      return { company: payload as Company };
    }

    throw new Error('Unexpected response from company creation endpoint.');
  }

  async updateCompany(data: Company): Promise<void> {
    await this.api.put('/Company', data);
  }

  async deleteCompany(id: number): Promise<void> {
    await this.api.delete(`/Company/${id}`);
  }
}
