import { Injectable, inject } from '@angular/core';
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

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly api = inject(ApiClientService);
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
    // Treats result as raw DTO as per specification
    const res = await this.api.get<any, CompanySettingsDto>('/CompanySettings');
    return res;
  }

  async updateCompanySettings(settings: CompanySettingsDto): Promise<void> {
    await this.api.put('/CompanySettings', settings);
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
