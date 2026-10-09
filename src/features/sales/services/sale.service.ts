import { Injectable, inject } from '@angular/core';
import {
  ApiClientService,
  extractArray,
} from '../../cuadreEnv/services/apiClient';
import type {
  SaleRequestDto,
  SaleResponseDto,
  ApiResponse,
  SendInvoiceEmailRequest,
} from '../../cuadreEnv/types/api';

const SALES_STORAGE_KEY = 'cuadreenv_local_sales_cache';

@Injectable({
  providedIn: 'root',
})
export class SaleService {
  private readonly api: ApiClientService;

  constructor(api?: ApiClientService) {
    this.api = api ?? inject(ApiClientService, { optional: true })!;
  }

  getLocalSales(): SaleResponseDto[] {
    try {
      const raw = localStorage.getItem(SALES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveLocalSale(sale: SaleResponseDto): void {
    try {
      const list = this.getLocalSales();
      const existingIdx = list.findIndex((s) => s.id === sale.id);
      if (existingIdx >= 0) {
        list[existingIdx] = sale;
      } else {
        list.unshift(sale);
      }
      localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local sale cache:', e);
    }
  }

  async getSales(params?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<SaleResponseDto[]>> {
    const validParams = {
      ...params,
      pageSize: params?.pageSize ? Math.min(100, Math.max(1, params.pageSize)) : 100,
    };
    try {
      const res = await this.api.get<any, any>('/Sale', { params: validParams });
      const apiSales = extractArray<SaleResponseDto>(res);
      const localList = this.getLocalSales();
      if (localList.length > 0) {
        const merged = [...apiSales];
        for (const loc of localList) {
          if (!merged.some((m) => m.id === loc.id)) {
            merged.unshift(loc);
          }
        }
        return { success: true, data: merged };
      }
      return { success: true, data: apiSales };
    } catch (err: any) {
      if (err?.status === 404) {
        try {
          const res2 = await this.api.get<any, any>('/sales', { params: validParams });
          const apiSales2 = extractArray<SaleResponseDto>(res2);
          const localList = this.getLocalSales();
          const merged2 = [...(apiSales2 || [])];
          for (const loc of localList) {
            if (!merged2.some((m) => m.id === loc.id)) {
              merged2.unshift(loc);
            }
          }
          return { success: true, data: merged2 };
        } catch {
          // Fallback failed
        }
      }
      const localFallback = this.getLocalSales();
      if (localFallback.length > 0) {
        return { success: true, data: localFallback };
      }
      return { success: false, data: [], message: 'No se pudo conectar con el servidor.' };
    }
  }

  async getSale(id: number): Promise<ApiResponse<SaleResponseDto>> {
    try {
      const res = await this.api.get<any, any>(`/Sale/${id}`);
      return { success: true, data: (res?.data ?? res?.Data ?? res) as SaleResponseDto };
    } catch {
      try {
        const res2 = await this.api.get<any, any>(`/sales/${id}`);
        return { success: true, data: (res2?.data ?? res2?.Data ?? res2) as SaleResponseDto };
      } catch {
        return { success: false, message: 'Venta no encontrada en el servidor.' };
      }
    }
  }

  async createSale(
    sale: SaleRequestDto,
  ): Promise<ApiResponse<SaleResponseDto>> {
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let createdSale: SaleResponseDto | null = null;

    try {
      // 1. Direct transaccional /Sale endpoint con Idempotency-Key
      const res = await this.api.post<any, any>('/Sale', sale, {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      });
      createdSale = (res?.data || res) as SaleResponseDto;
    } catch (err: any) {
      // Fallback a /caja/sales si la API tiene rutas unificadas de caja
      try {
        const cajaRes = await this.api.post<any, any>('/caja/sales', {
          idempotencyKey,
          customerId: sale.customerId || null,
          cashRegisterId: sale.cashRegisterId || 1,
          date: new Date().toISOString(),
          createBy: 'system',
          items: (sale.details || []).map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        }, {
          headers: { 'X-Idempotency-Key': idempotencyKey },
        });
        createdSale = (cajaRes?.data || cajaRes) as SaleResponseDto;
      } catch (cajaErr: any) {
        // Propagar el error oficial de la API (ej. stock insuficiente, caja cerrada, etc.)
        throw (err?.mappedError || err?.error ? err : cajaErr);
      }
    }

    if (!createdSale) {
      throw new Error('No se pudo registrar la venta en el servidor.');
    }

    this.saveLocalSale(createdSale);

    return {
      success: true,
      data: createdSale,
      message: 'Venta registrada exitosamente.',
    };
  }

  async updateSale(sale: SaleResponseDto): Promise<void> {
    try {
      await this.api.put<any, any>('/Sale', sale);
    } catch {
      // local cache
    }
    this.saveLocalSale(sale);
  }

  async deleteSale(id: number): Promise<void> {
    try {
      await this.api.delete<any, any>(`/Sale/${id}`);
    } catch {
      // local cache
    }
    const list = this.getLocalSales().filter((s) => s.id !== id);
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(list));
  }

  async addPayment(
    saleId: number,
    amount: number,
    reference: string,
  ): Promise<void> {
    await this.api.post<any, any>(`/Sale/${saleId}/payments`, { amount, reference });
  }

  async cancelSale(saleId: number, reason: string): Promise<void> {
    await this.api.post<any, any>(`/Sale/${saleId}/cancel`, { reason });
  }

  async sendInvoiceEmail(
    saleId: number | string,
    request: SendInvoiceEmailRequest,
  ): Promise<any> {
    return await this.api.post<SendInvoiceEmailRequest, any>(
      `/Sale/${saleId}/send-email`,
      request,
    );
  }
}
