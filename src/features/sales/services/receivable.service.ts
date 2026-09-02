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

  // Seed default data if storage is empty
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
    const seed: ReceivableDto[] = [
      {
        id: 123,
        invoiceNumber: 'INV-000123',
        customerId: 1,
        customerName: 'Juan Pérez',
        customerPhone: '809-555-0123',
        customerEmail: 'juan.perez@correo.com',
        description: 'Venta de mercadería y equipos informáticos',
        totalAmount: 25400.0,
        paidAmount: 13000.0,
        pendingAmount: 12400.0,
        status: 'Pendiente',
        creationDate: new Date(Date.now() - 10 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        avatarColor: '#ede9fe',
        paymentPlan: {
          installmentAmount: 5000.0,
          totalInstallments: 5,
          startDate: '2026-05-15',
          frequency: 'Quincenal',
        },
        payments: [
          {
            id: 1,
            amount: 5000.0,
            date: '2026-05-15 09:15 AM',
            method: 'Transferencia',
            reference: 'TRF-001234',
          },
          {
            id: 2,
            amount: 5000.0,
            date: '2026-05-22 02:45 PM',
            method: 'Efectivo',
            reference: 'REC-000567',
          },
          {
            id: 3,
            amount: 3000.0,
            date: '2026-05-27 10:30 AM',
            method: 'Transferencia',
            reference: 'TRF-002345',
            isCurrent: true,
          },
        ],
      },
      {
        id: 124,
        invoiceNumber: 'INV-000124',
        customerId: 2,
        customerName: 'María González',
        customerPhone: '809-555-0124',
        customerEmail: 'maria.g@correo.com',
        description: 'Servicio de consultoría y licencias',
        totalAmount: 18750.5,
        paidAmount: 0.0,
        pendingAmount: 18750.5,
        status: 'Pendiente',
        creationDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 25 * 86400000).toISOString(),
        avatarColor: '#dcfce7',
        paymentPlan: {
          installmentAmount: 6250.0,
          totalInstallments: 3,
          startDate: '2026-06-01',
          frequency: 'Mensual',
        },
        payments: [],
      },
      {
        id: 125,
        invoiceNumber: 'INV-000125',
        customerId: 3,
        customerName: 'Ferretería Del Sur',
        customerPhone: '809-555-0125',
        customerEmail: 'contacto@ferreteriadelsur.do',
        description: 'Materiales de construcción y herramientas',
        totalAmount: 37200.0,
        paidAmount: 0.0,
        pendingAmount: 37200.0,
        status: 'Pendiente',
        creationDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
        avatarColor: '#e0f2fe',
        paymentPlan: {
          installmentAmount: 9300.0,
          totalInstallments: 4,
          startDate: '2026-06-10',
          frequency: 'Quincenal',
        },
        payments: [],
      },
      {
        id: 126,
        invoiceNumber: 'INV-000126',
        customerId: 4,
        customerName: 'Comercial López',
        customerPhone: '809-555-0126',
        customerEmail: 'lopez.comercial@correo.com',
        description: 'Venta de insumos de papelería al por mayor',
        totalAmount: 12980.75,
        paidAmount: 0.0,
        pendingAmount: 12980.75,
        status: 'Pendiente',
        creationDate: new Date(Date.now() - 7 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        avatarColor: '#ffedd5',
        paymentPlan: {
          installmentAmount: 6490.0,
          totalInstallments: 2,
          startDate: '2026-06-05',
          frequency: 'Quincenal',
        },
        payments: [],
      },
      {
        id: 127,
        invoiceNumber: 'INV-000127',
        customerId: 5,
        customerName: 'Distribuidora Ramos',
        customerPhone: '809-555-0127',
        customerEmail: 'ventas@distribuidoramos.do',
        description: 'Lote de bebidas y productos de consumo masivo',
        totalAmount: 44300.0,
        paidAmount: 0.0,
        pendingAmount: 44300.0,
        status: 'Pendiente',
        creationDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        avatarColor: '#fce7f3',
        paymentPlan: {
          installmentAmount: 11075.0,
          totalInstallments: 4,
          startDate: '2026-06-15',
          frequency: 'Semanal',
        },
        payments: [],
      },
      {
        id: 128,
        invoiceNumber: 'INV-000128',
        customerId: 6,
        customerName: 'Inversiones Caribe',
        customerPhone: '809-555-0128',
        customerEmail: 'admin@inversionescaribe.do',
        description: 'Suscripción corporativa anual y soporte',
        totalAmount: 29910.25,
        paidAmount: 0.0,
        pendingAmount: 29910.25,
        status: 'Pendiente',
        creationDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 45 * 86400000).toISOString(),
        avatarColor: '#fef3c7',
        paymentPlan: {
          installmentAmount: 9970.0,
          totalInstallments: 3,
          startDate: '2026-06-20',
          frequency: 'Mensual',
        },
        payments: [],
      },
    ];
    this.saveStoredReceivables(seed);
    return seed;
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
