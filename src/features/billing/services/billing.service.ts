import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import { CashRegisterService } from '../../cash-register/services/cash-register.service';
import { ProductService } from '../../products/services/product.service';
import type { ApiResponse } from '../../cuadreEnv/types/api';
import type { Billing, HeaderDto, ProductDetails, TotalModels } from '../../../app/models/billing';

const BILLING_STORAGE_KEY = 'cuadreenv_billing_invoices_db';

@Injectable({
  providedIn: 'root',
})
export class BillingService {
  private api = inject(ApiClientService);
  private cashRegisterService = inject(CashRegisterService);
  private productService = inject(ProductService);

  private getLocalBillings(): Billing[] {
    try {
      const raw = localStorage.getItem(BILLING_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalBillings(list: Billing[]): void {
    try {
      localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local billings:', e);
    }
  }

  calculateLineTotals(
    price: number,
    quantity: number,
    discountPercentage: number = 0,
    itbisPercentage: number = 18,
  ): {
    discountAmount: number;
    subTotal: number;
    itbisAmount: number;
    totalAmount: number;
  } {
    const p = Math.max(0, Number(price) || 0);
    const q = Math.max(0, Number(quantity) || 0);
    const dPct = Math.max(0, Math.min(100, Number(discountPercentage) || 0));
    const itbisPct = Math.max(0, Number(itbisPercentage) || 0);

    const gross = p * q;
    const discountAmount = Math.round(gross * (dPct / 100) * 100) / 100;
    const subTotal = Math.round((gross - discountAmount) * 100) / 100;
    const itbisAmount = Math.round(subTotal * (itbisPct / 100) * 100) / 100;
    const totalAmount = Math.round((subTotal + itbisAmount) * 100) / 100;

    return {
      discountAmount,
      subTotal,
      itbisAmount,
      totalAmount,
    };
  }

  calculateTotals(items: ProductDetails[]): TotalModels {
    let subtotalAmount = 0;
    let totalDiscount = 0;
    let totalItbis = 0;
    let totalAmount = 0;

    for (const item of items) {
      const line = this.calculateLineTotals(
        item.price,
        item.quantity,
        item.discountPercentage,
        item.itbisPercentage,
      );
      item.discountAmount = line.discountAmount;
      item.subTotal = line.subTotal;
      item.itbisAmount = line.itbisAmount;
      item.totalAmount = line.totalAmount;

      subtotalAmount += line.subTotal;
      totalDiscount += line.discountAmount;
      totalItbis += line.itbisAmount;
      totalAmount += line.totalAmount;
    }

    return {
      subtotalAmount: Math.round(subtotalAmount * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalItbis: Math.round(totalItbis * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  async getBillings(filters?: {
    startDate?: string;
    endDate?: string;
    clientId?: number;
    statusId?: number;
    documentNumber?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<Billing[]>> {
    try {
      const res = await this.api.get<any, any>('/Billing', { params: filters });
      const list = extractArray<Billing>(res);
      if (list && list.length > 0) {
        return { success: true, data: list };
      }
    } catch {
      // fallback
    }

    let local = this.getLocalBillings();
    if (filters) {
      if (filters.clientId) {
        local = local.filter((b) => b.clientId === filters.clientId);
      }
      if (filters.statusId) {
        local = local.filter((b) => b.statusId === filters.statusId);
      }
      if (filters.documentNumber) {
        const term = filters.documentNumber.toLowerCase();
        local = local.filter(
          (b) =>
            (b.billingNumber || '').toLowerCase().includes(term) ||
            (b.ncf || '').toLowerCase().includes(term),
        );
      }
      if (filters.startDate) {
        const start = new Date(filters.startDate).getTime();
        local = local.filter((b) => new Date(b.creationDate).getTime() >= start);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate).getTime();
        local = local.filter((b) => new Date(b.creationDate).getTime() <= end);
      }
    }

    return { success: true, data: local };
  }

  async getBillingById(id: number): Promise<ApiResponse<Billing>> {
    try {
      const res = await this.api.get<any, any>(`/Billing/${id}`);
      return { success: true, data: res as Billing };
    } catch {
      const found = this.getLocalBillings().find((b) => b.id === id);
      if (found) return { success: true, data: found };
      return { success: false, message: 'Factura no encontrada.' };
    }
  }

  async createBilling(header: HeaderDto, items: ProductDetails[]): Promise<ApiResponse<Billing>> {
    const totals = this.calculateTotals(items);
    const id = Date.now();
    const billingSeq = String(Math.floor(1000 + Math.random() * 9000));
    const assignedNumber = `FAC-${billingSeq}`;
    
    // NCF generator (B01 Crédito Fiscal, B02 Consumidor Final)
    const ncfPrefix = header.voucherTypeId === 1 ? 'B02' : 'B01';
    const assignedNCF = `${ncfPrefix}${String(Math.floor(10000000 + Math.random() * 90000000))}`;

    let cashSessionId: number | undefined;
    if (header.billingTypeId === 1) { // Contado
      try {
        const sessionRes = await this.cashRegisterService.getActiveSession();
        if (sessionRes?.success && sessionRes.data) {
          cashSessionId = sessionRes.data.id;
        }
      } catch {
        // ignore
      }
    }

    const newBilling: Billing = {
      id,
      prefix: 'FAC',
      billingNumber: assignedNumber,
      creationDate: new Date().toISOString(),
      clientId: header.clientId,
      clientName: header.clientName || `Cliente #${header.clientId}`,
      clientRnc: header.rncOrCedula || '000-0000000-0',
      billingTypeId: header.billingTypeId,
      billingTypeName: header.billingTypeId === 1 ? 'Contado' : 'Crédito',
      voucherTypeId: header.voucherTypeId,
      voucherTypeName: header.voucherTypeId === 1 ? 'Consumidor Final' : 'Crédito Fiscal',
      ncf: assignedNCF,
      warehouseId: header.warehouseId,
      statusId: 1, // Emitida
      amountSubTotal: totals.subtotalAmount,
      amountDesc: totals.totalDiscount,
      amountItbis: totals.totalItbis,
      amountTotal: totals.totalAmount,
      hasAFullCreditNote: false,
      showDetail: false,
      productDetails: items,
      details: items,
      cashSessionId,
      paymentMethod: header.billingTypeId === 1 ? 'CASH' : 'MIXED',
    };

    // 1. Try backend POST /Billing or /Sale
    try {
      await this.api.post<any, any>('/Billing', newBilling);
    } catch {
      try {
        await this.api.post<any, any>('/Sale', {
          customerId: header.clientId,
          total: totals.totalAmount,
          paidAmount: header.billingTypeId === 1 ? totals.totalAmount : 0,
          cashRegisterId: cashSessionId,
          details: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.price,
          })),
        });
      } catch (err) {
        console.warn('API sync warning:', err);
      }
    }

    // 2. Persist locally
    const currentList = this.getLocalBillings();
    currentList.unshift(newBilling);
    this.saveLocalBillings(currentList);

    // 3. If Cash, register cash movement in session
    if (header.billingTypeId === 1 && cashSessionId) {
      try {
        await this.cashRegisterService.addMovement({
          type: 'Entrada',
          category: 'Ventas',
          description: `Cobro Factura ${assignedNumber} (NCF: ${assignedNCF})`,
          amount: totals.totalAmount,
        });
      } catch (movErr) {
        console.warn('Cash movement error on billing:', movErr);
      }
    }

    // 4. Update product stock locally/remotely
    for (const item of items) {
      try {
        const prod = await this.productService.getProduct(item.productId);
        if (prod?.success && prod.data) {
          const currentStock = prod.data.stock || 0;
          await this.productService.updateProduct({
            ...prod.data,
            stock: Math.max(0, currentStock - item.quantity),
          });
        }
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      data: newBilling,
      message: `Factura ${assignedNumber} emitida exitosamente con NCF ${assignedNCF}.`,
    };
  }

  async getQuotationForBilling(quotationId: string | number): Promise<ApiResponse<{ header: HeaderDto; items: ProductDetails[] }>> {
    try {
      const res = await this.api.get<any, any>(`/Quotation/${quotationId}`);
      if (res) {
        const data = res.data || res;
        return {
          success: true,
          data: {
            header: {
              clientId: data.clientId || 1,
              clientName: data.clientName || 'Cliente Cotización',
              billingTypeId: 1,
              voucherTypeId: 1,
              warehouseId: data.warehouseId || 1,
            },
            items: (data.items || data.details || []).map((it: any) => ({
              productId: it.productId,
              barCode: it.barCode || `PROD-${it.productId}`,
              productName: it.productName || `Producto #${it.productId}`,
              quantity: it.quantity || 1,
              price: it.price || it.unitPrice || 0,
              discountPercentage: it.discountPercentage || 0,
              discountAmount: it.discountAmount || 0,
              itbisPercentage: 18,
              itbisAmount: it.itbisAmount || 0,
              subTotal: it.subTotal || 0,
              totalAmount: it.totalAmount || 0,
              warehouseId: data.warehouseId || 1,
            })),
          },
        };
      }
    } catch {
      // Mock quotation conversion
    }

    return {
      success: true,
      data: {
        header: {
          clientId: 1,
          clientName: 'Cliente Ejemplo Cotización',
          billingTypeId: 1,
          voucherTypeId: 1,
          warehouseId: 1,
        },
        items: [
          {
            productId: 1,
            barCode: 'PROD-001',
            productName: 'Servicio / Producto de Cotización',
            quantity: 2,
            price: 500,
            discountPercentage: 0,
            discountAmount: 0,
            itbisPercentage: 18,
            itbisAmount: 180,
            subTotal: 1000,
            totalAmount: 1180,
            warehouseId: 1,
          },
        ],
      },
    };
  }
}
