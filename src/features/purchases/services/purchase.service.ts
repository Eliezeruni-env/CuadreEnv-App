import { Injectable, inject } from '@angular/core';
import {
  ApiClientService,
  extractArray,
} from '../../cuadreEnv/services/apiClient';
import type { PurchaseDto, ApiResponse } from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class PurchaseService {
  private readonly api = inject(ApiClientService);
  async getPurchases(params?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<PurchaseDto[]>> {
    const res = await this.api.get<any, any>('/Purchase', { params });
    return { success: true, data: extractArray<PurchaseDto>(res) };
  }

  async getPurchase(id: number): Promise<ApiResponse<PurchaseDto>> {
    const res = await this.api.get<any, any>(`/Purchase/${id}`);
    return { success: true, data: res as PurchaseDto };
  }

  async createPurchase(
    purchase: PurchaseDto,
  ): Promise<ApiResponse<PurchaseDto>> {
    const res = await this.api.post<any, any>('/Purchase', purchase);
    return { success: true, data: res as PurchaseDto };
  }

  async updatePurchase(purchase: PurchaseDto): Promise<void> {
    await this.api.put('/Purchase', purchase);
  }

  async deletePurchase(id: number): Promise<void> {
    await this.api.delete(`/Purchase/${id}`);
  }
}
