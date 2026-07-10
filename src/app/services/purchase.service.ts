import { Injectable } from '@angular/core';
import api, { extractArray } from './apiClient';
import type { PurchaseDto, ApiResponse } from '../models/api';

@Injectable({
  providedIn: 'root',
})
export class PurchaseService {
  async getPurchases(): Promise<ApiResponse<PurchaseDto[]>> {
    const res = await api.get<any>('/purchase');
    return { success: true, data: extractArray<PurchaseDto>(res.data) };
  }

  async getPurchase(id: number): Promise<ApiResponse<PurchaseDto>> {
    const res = await api.get<any>(`/purchase/${id}`);
    if (res.data && typeof res.data.success === 'boolean') {
      return res.data;
    }
    return { success: true, data: res.data };
  }

  async createPurchase(purchase: PurchaseDto): Promise<ApiResponse<PurchaseDto>> {
    const res = await api.post<ApiResponse<PurchaseDto>>('/purchase', purchase);
    return res.data;
  }

  async updatePurchase(purchase: PurchaseDto): Promise<void> {
    await api.put('/purchase', purchase);
  }

  async deletePurchase(id: number): Promise<void> {
    await api.delete(`/purchase/${id}`);
  }
}
