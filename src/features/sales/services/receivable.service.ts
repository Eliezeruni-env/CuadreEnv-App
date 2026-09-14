import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import { CustomerService } from '../../customers/services/customer.service';
import { CashRegisterService } from '../../cash-register/services/cash-register.service';
import type { ApiResponse, CustomerDto, SaleResponseDto } from '../../cuadreEnv/types/api';

export interface PaymentPlanDto {
  installmentAmount: number;
  totalInstallments: number;
  startDate: string;
  frequency: 'Semanal' | 'Quincenal' | 'Mensual' | 'Diaria';
}

export interface PaymentRecordDto {
  id: number;
  amount: number;
  date: string;
  method: string;
  reference?: string | null;
  notes?: string | null;
  isCurrent?: boolean;
}

export interface ReceivableDto {
  id: number;
  invoiceNumber: string;
  customerId?: number | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerIdentification?: string | null;
  description: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'Pendiente' | 'Parcial' | 'Pagado' | 'Vencido';
  creationDate: string;
  dueDate?: string | null;
  paymentPlan?: PaymentPlanDto | null;
  payments: PaymentRecordDto[];
  avatarColor: string;
  isReopened?: boolean;
  reopenedDate?: string;
  settledDate?: string;
}

export interface CreateReceivableDto {
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  description: string;
  totalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  startDate: string;
  frequency: 'Semanal' | 'Quincenal' | 'Mensual' | 'Diaria';
}

const AVATAR_COLORS = [
  { bg: '#ede9fe', color: '#7c3aed' }, // Purple
  { bg: '#dcfce7', color: '#16a34a' }, // Green
  { bg: '#e0f2fe', color: '#0284c7' }, // Blue
  { bg: '#ffedd5', color: '#ea580c' }, // Orange
  { bg: '#fce7f3', color: '#db2777' }, // Pink
  { bg: '#fef3c7', color: '#d97706' }, // Yellow
];

@Injectable({
  providedIn: 'root',
})
export class ReceivableService {
  private readonly api: ApiClientService;
  private readonly customerService: CustomerService;
  private readonly cashRegisterService?: CashRegisterService;

  constructor(
    api?: ApiClientService,
    customerService?: CustomerService,
    cashRegisterService?: CashRegisterService,
  ) {
    if (api) {
      this.api = api;
    } else {
      try {
        this.api = inject(ApiClientService, { optional: true }) as any;
      } catch {
        this.api = undefined as any;
      }
    }

    if (customerService) {
      this.customerService = customerService;
    } else {
      try {
        this.customerService = inject(CustomerService, { optional: true }) as any;
      } catch {
        this.customerService = undefined as any;
      }
    }

    if (cashRegisterService) {
      this.cashRegisterService = cashRegisterService;
    } else {
      try {
        this.cashRegisterService = inject(CashRegisterService, { optional: true }) as any;
      } catch {
        this.cashRegisterService = undefined;
      }
    }
  }

  private readonly storageKey = 'cuadre_receivables_store_v1';

  private inMemoryCache: ReceivableDto[] | null = null;

  // Read stored data without fake mock seeds
  private getStoredReceivables(): ReceivableDto[] {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch {
        // ignore
      }
    } else if (this.inMemoryCache) {
      return [...this.inMemoryCache];
    }
    return [];
  }

  private saveStoredReceivables(items: ReceivableDto[]) {
    this.inMemoryCache = [...items];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(items));
      } catch {
        // ignore
      }
    }
  }

  async getReceivables(): Promise<ApiResponse<ReceivableDto[]>> {
    // Try merging with backend sales where paidAmount < total
    try {
      const salesRes = await this.api.get<any, any>('/Sale');
      const sales = extractArray<SaleResponseDto>(salesRes);
      const stored = this.getStoredReceivables();

      // If backend has sales, integrate any sales with pending balances
      if (sales && sales.length > 0) {
        const custRes = await this.customerService.getCustomers();
        const customers = custRes.data || [];

        for (const s of sales) {
          if (s.isCancelled) continue;
          const pending = Math.max(0, (s.total || 0) - (s.paidAmount || 0));
          if (pending > 0) {
            const existing = stored.find((r) => r.id === s.id);
            const customer = customers.find((c) => c.id === s.customerId);
            const colorIdx = s.id % AVATAR_COLORS.length;

            if (!existing) {
              stored.unshift({
                id: s.id,
                invoiceNumber: `INV-${String(s.id).padStart(6, '0')}`,
                customerId: s.customerId,
                customerName: customer?.name || `Cliente #${s.customerId || s.id}`,
                customerPhone: customer?.phone || '',
                customerEmail: customer?.email || '',
                description: 'Venta a crédito',
                totalAmount: s.total,
                paidAmount: s.paidAmount || 0,
                pendingAmount: pending,
                status: s.paidAmount > 0 ? 'Parcial' : 'Pendiente',
                creationDate: s.creationDate || new Date().toISOString(),
                dueDate: s.dueDate,
                avatarColor: AVATAR_COLORS[colorIdx].bg,
                payments: s.paidAmount > 0 ? [
                  {
                    id: 1,
                    amount: s.paidAmount,
                    date: new Date().toLocaleDateString('es-DO'),
                    method: 'Efectivo',
                    reference: 'Abono inicial',
                  }
                ] : [],
              });
            }
          }
        }
        this.saveStoredReceivables(stored);
      }
      return { success: true, data: stored };
    } catch {
      // Fallback cleanly to local store
      return { success: true, data: this.getStoredReceivables() };
    }
  }

  async getReceivable(id: number): Promise<ApiResponse<ReceivableDto>> {
    const list = this.getStoredReceivables();
    const item = list.find((r) => r.id === id);
    if (!item) {
      return { success: false, message: 'Venta por cobrar no encontrada.' };
    }
    return { success: true, data: item };
  }

  async createReceivable(
    dto: CreateReceivableDto,
  ): Promise<ApiResponse<ReceivableDto>> {
    const list = this.getStoredReceivables();
    const nextId = Math.max(100, ...list.map((r) => r.id)) + 1;
    const colorIdx = nextId % AVATAR_COLORS.length;

    const freqMap: Record<string, string> = {
      'Mensual': 'Monthly',
      'Quincenal': 'Biweekly',
      'Semanal': 'Weekly',
      'Diaria': 'Daily',
    };

    let backendId = nextId;

    // Attempt to record in new backend AccountReceivable API
    try {
      const arPayload = {
        companyId: 1,
        customerId: dto.customerId || null,
        saleId: null,
        totalAmount: dto.totalAmount,
        paidAmount: 0,
        dueDate: dto.startDate,
        plan: {
          installmentAmount: dto.installmentAmount,
          totalInstallments: dto.totalInstallments,
          frequency: freqMap[dto.frequency] || 'Monthly',
          startsAt: dto.startDate,
        },
      };

      const res = await this.api.post<any, any>('/AccountReceivable', arPayload);
      if (res?.id) {
        backendId = res.id;
      }
    } catch {
      // Fallback to /Sale if AccountReceivable not yet available
      try {
        await this.api.post('/Sale', {
          customerId: dto.customerId || null,
          total: dto.totalAmount,
          paidAmount: 0,
          dueDate: dto.startDate,
          details: [
            {
              productId: 1,
              quantity: 1,
              unitPrice: dto.totalAmount,
            },
          ],
        });
      } catch {
        // ignore
      }
    }

    const newReceivable: ReceivableDto = {
      id: backendId,
      invoiceNumber: `INV-${String(backendId).padStart(6, '0')}`,
      customerId: dto.customerId || null,
      customerName: dto.customerName || 'Cliente General',
      customerPhone: dto.customerPhone || null,
      customerEmail: dto.customerEmail || null,
      description: dto.description,
      totalAmount: dto.totalAmount,
      paidAmount: 0,
      pendingAmount: dto.totalAmount,
      status: 'Pendiente',
      creationDate: new Date().toISOString(),
      dueDate: dto.startDate,
      avatarColor: AVATAR_COLORS[colorIdx].bg,
      paymentPlan: {
        installmentAmount: dto.installmentAmount,
        totalInstallments: dto.totalInstallments,
        startDate: dto.startDate,
        frequency: dto.frequency,
      },
      payments: [],
    };

    list.unshift(newReceivable);
    this.saveStoredReceivables(list);

    return { success: true, data: newReceivable };
  }

  async addPayment(
    receivableId: number,
    payment: {
      amount: number;
      date?: string;
      method: string;
      reference?: string;
      notes?: string;
    },
  ): Promise<ApiResponse<ReceivableDto>> {
    const list = this.getStoredReceivables();
    const item = list.find((r) => r.id === receivableId);
    if (!item) {
      return { success: false, message: 'Venta por cobrar no encontrada.' };
    }

    const payId = item.payments.length + 1;
    const newRecord: PaymentRecordDto = {
      id: payId,
      amount: payment.amount,
      date: payment.date || new Date().toLocaleString('es-DO'),
      method: payment.method,
      reference: payment.reference || null,
      notes: payment.notes || null,
      isCurrent: true,
    };

    // Mark previous payments as not current
    item.payments.forEach((p) => (p.isCurrent = false));
    item.payments.push(newRecord);

    item.paidAmount += payment.amount;
    item.pendingAmount = Math.max(0, item.totalAmount - item.paidAmount);
    item.status = item.pendingAmount === 0 ? 'Pagado' : 'Parcial';

    // Check active cash register session
    let cashRegisterId: number | null = null;
    if (this.cashRegisterService) {
      try {
        const sessRes = await this.cashRegisterService.getActiveSession();
        if (sessRes.data?.isOpen) {
          cashRegisterId = sessRes.data.id;
        }
      } catch {
        // ignore
      }
    }

    const methodCode = payment.method === 'Efectivo' ? 'CASH' : payment.method === 'Transferencia' ? 'TRANSFER' : payment.method === 'Tarjeta' ? 'CARD' : 'CHECK';

    // Post to AccountReceivable payments endpoint
    try {
      await this.api.post(`/AccountReceivable/${receivableId}/payments`, {
        amount: payment.amount,
        method: methodCode,
        reference: payment.reference || null,
        cashRegisterId: cashRegisterId,
      });
    } catch {
      // Fallback to Sale payments
      try {
        await this.api.post(`/Sale/${receivableId}/payments`, {
          amount: payment.amount,
          reference: payment.reference || payment.method,
          method: methodCode,
          cashRegisterId: cashRegisterId,
        });
      } catch {
        // ignore
      }
    }

    // Automatically sync with local Cash Register if active
    if (this.cashRegisterService) {
      try {
        await this.cashRegisterService.addMovement({
          type: 'Entrada',
          category: 'Cobros',
          description: `Cobro de cliente ${item.customerName} (${item.invoiceNumber})`,
          amount: payment.amount,
          paymentMethod: payment.method,
          reference: payment.reference || item.invoiceNumber,
        });
      } catch {
        // ignore if cash register is closed
      }
    }

    this.saveStoredReceivables(list);
    return { success: true, data: item };
  }

  async payInstallment(
    receivableId: number,
    installmentId: number,
    params: {
      amount: number;
      method: string;
    },
  ): Promise<ApiResponse<any>> {
    let cashRegisterId: number | null = null;
    if (this.cashRegisterService) {
      try {
        const sessRes = await this.cashRegisterService.getActiveSession();
        if (sessRes.data?.isOpen) {
          cashRegisterId = sessRes.data.id;
        }
      } catch {
        // ignore
      }
    }

    const methodCode = params.method === 'Efectivo' ? 'CASH' : params.method === 'Transferencia' ? 'TRANSFER' : params.method === 'Tarjeta' ? 'CARD' : 'CHECK';

    // Try posting to backend pay installment endpoint
    try {
      await this.api.post(`/AccountReceivable/${receivableId}/installments/${installmentId}/pay`, {
        amount: params.amount,
        method: methodCode,
        cashRegisterId: cashRegisterId,
      });
    } catch {
      // ignore
    }

    // Register payment record in receivable
    return this.addPayment(receivableId, {
      amount: params.amount,
      method: params.method,
      reference: `Cuota #${installmentId}`,
      notes: `Pago de cuota #${installmentId}`,
    });
  }

  async updatePayment(
    receivableId: number,
    paymentId: number,
    payment: {
      amount: number;
      date?: string;
      method: string;
      reference?: string;
      notes?: string;
    },
  ): Promise<ApiResponse<ReceivableDto>> {
    const list = this.getStoredReceivables();
    const item = list.find((r) => r.id === receivableId);
    if (!item) {
      return { success: false, message: 'Venta por cobrar no encontrada.' };
    }

    const payIdx = item.payments.findIndex((p) => p.id === paymentId);
    if (payIdx === -1) {
      return { success: false, message: 'Pago no encontrado en el historial.' };
    }

    item.payments[payIdx] = {
      ...item.payments[payIdx],
      amount: payment.amount,
      date: payment.date || item.payments[payIdx].date,
      method: payment.method,
      reference: payment.reference || null,
      notes: payment.notes || null,
    };

    // Recalculate total paid & pending balance
    item.paidAmount = item.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    item.pendingAmount = Math.max(0, item.totalAmount - item.paidAmount);
    item.status = item.pendingAmount === 0 ? 'Pagado' : item.paidAmount > 0 ? 'Parcial' : 'Pendiente';

    this.saveStoredReceivables(list);
    return { success: true, data: item };
  }

  async deletePayment(
    receivableId: number,
    paymentId: number,
  ): Promise<ApiResponse<ReceivableDto>> {
    const list = this.getStoredReceivables();
    const item = list.find((r) => r.id === receivableId);
    if (!item) {
      return { success: false, message: 'Venta por cobrar no encontrada.' };
    }

    const payIdx = item.payments.findIndex((p) => p.id === paymentId);
    if (payIdx === -1) {
      return { success: false, message: 'Pago no encontrado en el historial.' };
    }

    item.payments.splice(payIdx, 1);

    // Recalculate total paid & pending balance
    item.paidAmount = item.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    item.pendingAmount = Math.max(0, item.totalAmount - item.paidAmount);
    item.status = item.pendingAmount === 0 ? 'Pagado' : item.paidAmount > 0 ? 'Parcial' : 'Pendiente';

    this.saveStoredReceivables(list);
    return { success: true, data: item };
  }

  async updateReceivable(
    id: number,
    updates: Partial<ReceivableDto>,
  ): Promise<ApiResponse<ReceivableDto>> {
    const list = this.getStoredReceivables();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) {
      return { success: false, message: 'Venta no encontrada.' };
    }

    list[idx] = { ...list[idx], ...updates };
    this.saveStoredReceivables(list);
    return { success: true, data: list[idx] };
  }

  async deleteReceivable(id: number): Promise<ApiResponse<boolean>> {
    const list = this.getStoredReceivables();
    const filtered = list.filter((r) => r.id !== id);
    this.saveStoredReceivables(filtered);

    try {
      await this.api.delete(`/Sale/${id}`);
    } catch {
      // ignore
    }

    return { success: true, data: true };
  }

  async reopenReceivable(id: number, reason?: string): Promise<ApiResponse<ReceivableDto>> {
    const list = this.getStoredReceivables();
    const item = list.find((r) => r.id === id);
    if (!item) {
      return { success: false, message: 'Cuenta por cobrar no encontrada.' };
    }

    item.status = item.paidAmount > 0 ? 'Parcial' : 'Pendiente';
    if (item.pendingAmount <= 0) {
      item.pendingAmount = Math.max(1, item.totalAmount - item.paidAmount);
    }
    item.isReopened = true;
    item.reopenedDate = new Date().toISOString();

    this.saveStoredReceivables(list);

    try {
      if (this.api) {
        await this.api.post(`/v1/AccountReceivable/${id}/reopen`, {
          reason: reason || 'Reapertura para corrección contable',
        });
      }
    } catch {
      // offline fallback
    }

    return { success: true, data: item, message: 'Cuenta por cobrar reactivada correctamente.' };
  }
}
