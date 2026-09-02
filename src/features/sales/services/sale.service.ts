import { Injectable, inject } from '@angular/core';
import {
  ApiClientService,
  extractArray,
} from '../../cuadreEnv/services/apiClient';
import type {
  SaleRequestDto,
  SaleResponseDto,
  ApiResponse,
} from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class SaleService {
  private readonly api = inject(ApiClientService);
  async getSales(params?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<SaleResponseDto[]>> {
    const res = await this.api.get<any, any>('/Sale', { params });
    return { success: true, data: extractArray<SaleResponseDto>(res) };
  }

  async getSale(id: number): Promise<ApiResponse<SaleResponseDto>> {
    const res = await this.api.get<any, any>(`/Sale/${id}`);
    return { success: true, data: res as SaleResponseDto };
  }

  async createSale(
    sale: SaleRequestDto,
  ): Promise<ApiResponse<SaleResponseDto>> {
    const res = await this.api.post<any, any>('/Sale', sale);
    return { success: true, data: res as SaleResponseDto };
  }

  async updateSale(sale: SaleResponseDto): Promise<void> {
    await this.api.put('/Sale', sale);
  }

  async deleteSale(id: number): Promise<void> {
    await this.api.delete(`/Sale/${id}`);
  }

  async addPayment(
    saleId: number,
    amount: number,
    reference: string,
  ): Promise<void> {
    await this.api.post(`/Sale/${saleId}/payments`, { amount, reference });
  }

  async cancelSale(saleId: number, reason: string): Promise<void> {
    await this.api.post(`/Sale/${saleId}/cancel`, { reason });
  }
}
