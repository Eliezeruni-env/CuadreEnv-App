import { Injectable } from '@angular/core';
import api from '../../cuadreEnv/services/apiClient';
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
  async getCompanies(): Promise<ApiResponse<Company[]>> {
    const res = await api.get<ApiResponse<Company[]>>('/company');
    return res.data;
  }

  async getCompany(id: number): Promise<Company> {
    const res = await api.get<ApiResponse<Company>>(`/company/${id}`);
    const body = res.data as ApiResponse<Company> | undefined;
    if (body?.success && body.data) {
      return body.data as Company;
    }
    throw new Error(body?.message || 'Unable to load company.');
  }

  async getCompanySettings(): Promise<CompanySettingsDto> {
    const res = await api.get<CompanySettingsDto>('/companysettings');
    return res.data as CompanySettingsDto;
  }

  async updateCompanySettings(settings: CompanySettingsDto): Promise<void> {
    await api.put('/companysettings', settings);
  }

  async createCompany(
    data: CreateCompanyRequest,
  ): Promise<CreateCompanyResult> {
    const res = await api.post('/company', data);
    const body = res.data as any;
    const payload = body?.data ?? body;

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
    await api.put('/company', data);
  }

  async deleteCompany(id: number): Promise<void> {
    await api.delete(`/company/${id}`);
  }
}
