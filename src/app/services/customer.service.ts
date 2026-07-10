import { Injectable } from '@angular/core';
import api, { extractArray } from './apiClient';
import type { CustomerDto, ApiResponse } from '../models/api';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  async getCustomers(): Promise<ApiResponse<CustomerDto[]>> {
    const res = await api.get<any>('/customer');
    return { success: true, data: extractArray<CustomerDto>(res.data) };
  }

  async getActiveCustomers(): Promise<ApiResponse<CustomerDto[]>> {
    const res = await api.get<any>('/customer/active');
    return { success: true, data: extractArray<CustomerDto>(res.data) };
  }

  async getCustomer(id: number): Promise<ApiResponse<CustomerDto>> {
    const res = await api.get<any>(`/customer/${id}`);
    if (res.data && typeof res.data.success === 'boolean') {
      return res.data;
    }
    return { success: true, data: res.data };
  }

  async createCustomer(customer: CustomerDto): Promise<ApiResponse<CustomerDto>> {
    const res = await api.post<ApiResponse<CustomerDto>>('/customer', customer);
    return res.data;
  }

  async updateCustomer(customer: CustomerDto): Promise<void> {
    await api.put('/customer', customer);
  }

  async deleteCustomer(id: number): Promise<void> {
    await api.delete(`/customer/${id}`);
  }
}
