import { Injectable, inject } from '@angular/core';
import {
  ApiClientService,
  extractArray,
} from '../../cuadreEnv/services/apiClient';
import type { CustomerDto, ApiResponse } from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private readonly api = inject(ApiClientService);
  async getCustomers(params?: {
    pageNumber?: number;
    pageSize?: number;
    search?: string;
  }): Promise<ApiResponse<CustomerDto[]>> {
    const res = await this.api.get<any, any>('/Customer', { params });
    return { success: true, data: extractArray<CustomerDto>(res) };
  }

  async getActiveCustomers(days?: number): Promise<ApiResponse<CustomerDto[]>> {
    const res = await this.api.get<any, any>('/Customer/active', {
      params: days !== undefined ? { days } : undefined,
    });
    return { success: true, data: extractArray<CustomerDto>(res) };
  }

  async getCustomer(id: number): Promise<ApiResponse<CustomerDto>> {
    const res = await this.api.get<any, any>(`/Customer/${id}`);
    return { success: true, data: res as CustomerDto };
  }

  async createCustomer(
    customer: CustomerDto,
  ): Promise<ApiResponse<CustomerDto>> {
    const res = await this.api.post<any, any>('/Customer', customer);
    return { success: true, data: res as CustomerDto };
  }

  async updateCustomer(customer: CustomerDto): Promise<void> {
    await this.api.put('/Customer', customer);
  }

  async deleteCustomer(id: number): Promise<void> {
    await this.api.delete(`/Customer/${id}`);
  }
}
