import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import type { ApiResponse } from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class AccountReceivableService {
  private readonly api = inject(ApiClientService);

  async getOverdue(): Promise<ApiResponse<any[]>> {
    const res = await this.api.get<any, any>('/AccountReceivable/overdue');
    return { success: true, data: extractArray<any>(res) };
  }

  async getDueSoon(days?: number): Promise<ApiResponse<any[]>> {
    const res = await this.api.get<any, any>('/AccountReceivable/due-soon', {
      params: days !== undefined ? { days } : undefined,
    });
    return { success: true, data: extractArray<any>(res) };
  }

  async addPayment(id: number, paymentData: any): Promise<ApiResponse<any>> {
    const res = await this.api.post<any, any>(`/AccountReceivable/${id}/payments`, paymentData);
    return { success: true, data: res };
  }
}
