import { Injectable } from '@angular/core';
import api, { extractArray } from '../../cuadreEnv/services/apiClient';
import type { PaymentDto, ApiResponse } from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  async getPayments(): Promise<ApiResponse<PaymentDto[]>> {
    const res = await api.get<any>('/payment');
    return { success: true, data: extractArray<PaymentDto>(res.data) };
  }

  async getPayment(id: number): Promise<ApiResponse<PaymentDto>> {
    const res = await api.get<any>(`/payment/${id}`);
    if (res.data && typeof res.data.success === 'boolean') {
      return res.data;
    }
    return { success: true, data: res.data };
  }

  async createPayment(payment: PaymentDto): Promise<ApiResponse<PaymentDto>> {
    const res = await api.post<ApiResponse<PaymentDto>>('/payment', payment);
    return res.data;
  }

  async updatePayment(payment: PaymentDto): Promise<void> {
    await api.put('/payment', payment);
  }

  async deletePayment(id: number): Promise<void> {
    await api.delete(`/payment/${id}`);
  }
}
