import { Injectable } from '@angular/core';
import api from './apiClient';
import type { Company, CreateCompanyRequest, ApiResponse } from '../models/api';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  async getCompanies(): Promise<ApiResponse<Company[]>> {
    const res = await api.get<ApiResponse<Company[]>>('/company');
    return res.data;
  }

  async getCompany(id: number): Promise<ApiResponse<Company>> {
    const res = await api.get<ApiResponse<Company>>(`/company/${id}`);
    return res.data;
  }

  async createCompany(data: CreateCompanyRequest): Promise<Company> {
    const res = await api.post<Company>('/company', data);
    return res.data;
  }

  async updateCompany(data: Company): Promise<void> {
    await api.put('/company', data);
  }

  async deleteCompany(id: number): Promise<void> {
    await api.delete(`/company/${id}`);
  }
}
