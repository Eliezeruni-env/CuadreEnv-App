import { Injectable } from '@angular/core';
import api, { extractArray } from './apiClient';
import type { SaleRequestDto, SaleResponseDto, ApiResponse } from '../models/api';

@Injectable({
  providedIn: 'root',
})
export class SaleService {
  async getSales(): Promise<ApiResponse<SaleResponseDto[]>> {
    const res = await api.get<any>('/sale');
    return { success: true, data: extractArray<SaleResponseDto>(res.data) };
  }

  async getSale(id: number): Promise<ApiResponse<SaleResponseDto>> {
    const res = await api.get<any>(`/sale/${id}`);
    if (res.data && typeof res.data.success === 'boolean') {
      return res.data;
    }
    return { success: true, data: res.data };
  }

  async createSale(sale: SaleRequestDto): Promise<ApiResponse<SaleResponseDto>> {
    const res = await api.post<ApiResponse<SaleResponseDto>>('/sale', sale);
    return res.data;
  }

  async updateSale(sale: SaleResponseDto): Promise<void> {
    await api.put('/sale', sale);
  }

  async deleteSale(id: number): Promise<void> {
    await api.delete(`/sale/${id}`);
  }

  async addPayment(saleId: number, amount: number, reference: string): Promise<void> {
    await api.post(`/sale/${saleId}/payments`, { amount, reference });
  }

  async cancelSale(saleId: number, reason: string): Promise<void> {
    await api.post(`/sale/${saleId}/cancel`, { reason });
  }
}
