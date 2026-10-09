import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import type { ApiResponse } from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class AccountReceivableService {
  private readonly api = inject(ApiClientService);

  /**
   * Fetches overdue accounts receivable.
   * Uses `/AccountReceivable` with local overdue filtering to avoid backend route collision on `{id}`.
   */
  async getOverdue(): Promise<ApiResponse<any[]>> {
    try {
      const res = await this.api.get<any, any>('/AccountReceivable');
      const items = extractArray<any>(res);
      const now = new Date();
      
      const overdueItems = items.filter((item: any) => {
        if (!item) return false;
        if (item.status === 'Overdue' || item.status === 'Vencido') return true;
        const dueDate = item.dueDate ? new Date(item.dueDate) : null;
        const pendingAmount = item.pendingAmount !== undefined ? item.pendingAmount : (item.totalAmount - (item.paidAmount || 0));
        return dueDate !== null && dueDate < now && pendingAmount > 0;
      });

      return { success: true, data: overdueItems };
    } catch (e: any) {
      console.warn('[AccountReceivableService] Could not fetch overdue accounts:', e?.message || e);
      return { success: true, data: [] };
    }
  }

  /**
   * Fetches accounts receivable due soon.
   */
  async getDueSoon(days = 7): Promise<ApiResponse<any[]>> {
    try {
      const res = await this.api.get<any, any>('/AccountReceivable/due-soon', {
        params: { days },
      });
      return { success: true, data: extractArray<any>(res) };
    } catch {
      // Fallback: calculate from all accounts
      try {
        const res = await this.api.get<any, any>('/AccountReceivable');
        const items = extractArray<any>(res);
        const now = new Date();
        const limitDate = new Date();
        limitDate.setDate(now.getDate() + days);

        const dueSoon = items.filter((item: any) => {
          if (!item || !item.dueDate) return false;
          const due = new Date(item.dueDate);
          const pending = item.pendingAmount !== undefined ? item.pendingAmount : (item.totalAmount - (item.paidAmount || 0));
          return due >= now && due <= limitDate && pending > 0;
        });

        return { success: true, data: dueSoon };
      } catch (fallbackErr: any) {
        console.warn('[AccountReceivableService] Could not fetch due soon accounts:', fallbackErr?.message || fallbackErr);
        return { success: true, data: [] };
      }
    }
  }

  async addPayment(id: number, paymentData: any): Promise<ApiResponse<any>> {
    try {
      const res = await this.api.post<any, any>(`/AccountReceivable/${id}/payments`, paymentData);
      return { success: true, data: res };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Error registrando pago' };
    }
  }
}
