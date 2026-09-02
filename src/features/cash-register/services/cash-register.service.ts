import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import type {
  CashRegisterDto,
  CashMovementDto,
  ApiResponse,
} from '../../cuadreEnv/types/api';

export interface CashRegisterSessionDto {
  id: number;
  name: string;
  cashierName: string;
  openedAt: string;
  initialAmount: number;
  currentBalance: number;
  totalIn: number;
  totalOut: number;
  isOpen: boolean;
  closedAt?: string | null;
  closingAmount?: number | null;
  expectedAmount?: number | null;
  difference?: number | null;
  closingNotes?: string | null;
}

export interface CashRegisterMovementItem {
  id: number;
  date: string;
  rawDate: string;
  type: 'Saldo inicial' | 'Entrada' | 'Salida';
  category: 'Apertura' | 'Ventas' | 'Cobros' | 'Ingresos' | 'Compras' | 'Gastos' | 'Retiro' | 'Ajuste';
  description: string;
  inAmount: number | null;
  outAmount: number | null;
  balance: number;
  paymentMethod?: string;
  reference?: string | null;
  saleId?: number | null;
}

const ACTIVE_SESSION_STORAGE_KEY = 'app_active_cash_register_session';

@Injectable({
  providedIn: 'root',
})
export class CashRegisterService {
  constructor(private api: ApiClientService = inject(ApiClientService, { optional: true }) as any) {}

  // Active Session & Lifecycle directly against DB
  async getActiveSession(): Promise<ApiResponse<CashRegisterSessionDto | null>> {
    try {
      const regRes = await this.api.get<any, any>('/CashRegister');
      const list = extractArray<CashRegisterDto>(regRes);
      const openReg = list.find((r) => r.isOpen);

      if (openReg) {
        // Fetch real movements from DB to calculate balance & totals
        const movRes = await this.api.get<any, any>('/CashMovement', {
          params: { cashRegisterId: openReg.id },
        });
        const movList = extractArray<CashMovementDto>(movRes);

        let totalIn = 0;
        let totalOut = 0;
        const initial = openReg.balance || 0;

        for (const m of movList) {
          const amt = Number(m.amount) || 0;
          const typeStr = (m.type || '').toUpperCase();
          if (typeStr === 'IN' || typeStr === 'ENTRADA') {
            totalIn += amt;
          } else if (typeStr === 'OUT' || typeStr === 'SALIDA') {
            totalOut += amt;
          }
        }

        const currentBalance = initial + totalIn - totalOut;

        const session: CashRegisterSessionDto = {
          id: openReg.id || 1,
          name: openReg.name || 'Caja Principal',
          cashierName: 'Administrador',
          openedAt: openReg.createdDate
            ? new Date(openReg.createdDate).toLocaleString('es-DO')
            : new Date().toLocaleString('es-DO'),
          initialAmount: initial,
          currentBalance,
          totalIn,
          totalOut,
          isOpen: true,
        };

        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
        }

        return { success: true, data: session };
      }
    } catch {
      // ignore
    }

    // If no open register found in DB
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
    return { success: true, data: null };
  }

  async openSession(params: {
    name?: string;
    initialAmount: number;
    cashierName?: string;
    notes?: string;
  }): Promise<ApiResponse<CashRegisterSessionDto>> {
    const regName = params.name?.trim() || 'Caja Principal';
    const initialAmt = Number(params.initialAmount) || 0;

    const res = await this.api.post<any, any>('/CashRegister/open', {
      name: regName,
      balance: initialAmt,
    });

    const backendId = res?.id || 1;
    const now = new Date();
    const formattedDate = now.toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const session: CashRegisterSessionDto = {
      id: backendId,
      name: regName,
      cashierName: params.cashierName || 'Administrador',
      openedAt: formattedDate,
      initialAmount: initialAmt,
      currentBalance: initialAmt,
      totalIn: 0,
      totalOut: 0,
      isOpen: true,
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
    }

    return { success: true, data: session };
  }

  async closeSession(params: {
    closingAmount: number;
    notes?: string;
  }): Promise<ApiResponse<{ expected: number; actual: number; diff: number }>> {
    const sessionRes = await this.getActiveSession();
    const session = sessionRes?.data;
    if (!session) {
      return { success: false, message: 'No hay una sesión de caja abierta actualmente.' };
    }

    const actual = Number(params.closingAmount) || 0;
    const expected = session.currentBalance;
    const diff = actual - expected;

    // Call backend API to close in database
    await this.api.post(`/CashRegister/${session.id}/close?closingAmount=${actual}`);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }

    return {
      success: true,
      data: {
        expected,
        actual,
        diff,
      },
    };
  }

  async getMovements(): Promise<ApiResponse<CashRegisterMovementItem[]>> {
    const sessionRes = await this.getActiveSession();
    const session = sessionRes?.data;
    if (!session) {
      return { success: true, data: [] };
    }

    try {
      const res = await this.api.get<any, any>('/CashMovement', {
        params: { cashRegisterId: session.id },
      });
      const list = extractArray<any>(res);

      let runningBalance = session.initialAmount;
      const items: CashRegisterMovementItem[] = [];

      // Initial opening movement
      items.push({
        id: 0,
        date: session.openedAt,
        rawDate: new Date().toISOString(),
        type: 'Saldo inicial',
        category: 'Apertura',
        description: 'Apertura de caja - Fondo Inicial',
        inAmount: session.initialAmount,
        outAmount: null,
        balance: session.initialAmount,
        paymentMethod: 'Efectivo',
      });

      for (const m of list) {
        const amt = Number(m.amount) || 0;
        const typeUpper = (m.type || '').toUpperCase();
        const isIn = typeUpper === 'IN' || typeUpper === 'ENTRADA';
        const desc = m.description || '';

        let category: CashRegisterMovementItem['category'] = 'Ingresos';
        if (desc.toLowerCase().includes('venta')) category = 'Ventas';
        else if (desc.toLowerCase().includes('cobro')) category = 'Cobros';
        else if (desc.toLowerCase().includes('compra')) category = 'Compras';
        else if (desc.toLowerCase().includes('gasto')) category = 'Gastos';
        else if (desc.toLowerCase().includes('retiro')) category = 'Retiro';
        else if (desc.toLowerCase().includes('ajuste')) category = 'Ajuste';
        else if (!isIn) category = 'Retiro';

        if (isIn) {
          runningBalance += amt;
        } else {
          runningBalance = Math.max(0, runningBalance - amt);
        }

        const dateStr = m.createdDate
          ? new Date(m.createdDate).toLocaleString('es-DO')
          : new Date().toLocaleString('es-DO');

        items.push({
          id: m.id,
          date: dateStr,
          rawDate: m.createdDate || new Date().toISOString(),
          type: isIn ? 'Entrada' : 'Salida',
          category,
          description: desc || (isIn ? 'Entrada de efectivo' : 'Salida de efectivo'),
          inAmount: isIn ? amt : null,
          outAmount: isIn ? null : amt,
          balance: runningBalance,
          paymentMethod: m.paymentMethod || 'Efectivo',
          reference: m.reference || null,
          saleId: m.saleId || null,
        });
      }

      return { success: true, data: items };
    } catch {
      return { success: true, data: [] };
    }
  }

  async addMovement(item: {
    type: 'Entrada' | 'Salida';
    category: 'Ventas' | 'Cobros' | 'Ingresos' | 'Compras' | 'Gastos' | 'Retiro' | 'Ajuste';
    description: string;
    amount: number;
    paymentMethod?: string;
    reference?: string | null;
  }): Promise<ApiResponse<CashRegisterMovementItem>> {
    const sessionRes = await this.getActiveSession();
    const session = sessionRes?.data;
    if (!session) {
      return { success: false, message: 'No hay una caja abierta para registrar movimientos.' };
    }

    const amt = Number(item.amount);
    if (amt <= 0) {
      return { success: false, message: 'El monto debe ser mayor a cero.' };
    }

    const res = await this.api.post<any, any>('/CashMovement', {
      cashRegisterId: session.id,
      amount: amt,
      type: item.type === 'Entrada' ? 'In' : 'Out',
      description: `${item.category}: ${item.description}`,
    });

    const movListRes = await this.getMovements();
    const lastItem = movListRes.data?.[movListRes.data.length - 1];

    return {
      success: true,
      data: lastItem || {
        id: res?.id || Date.now(),
        date: new Date().toLocaleString('es-DO'),
        rawDate: new Date().toISOString(),
        type: item.type,
        category: item.category,
        description: item.description,
        inAmount: item.type === 'Entrada' ? amt : null,
        outAmount: item.type === 'Salida' ? amt : null,
        balance: session.currentBalance + (item.type === 'Entrada' ? amt : -amt),
        paymentMethod: item.paymentMethod || 'Efectivo',
      },
    };
  }

  async registerQuickSale(saleData: {
    customerId?: number | null;
    customerName?: string;
    items: {
      productId: number;
      productName: string;
      unitPrice: number;
      quantity: number;
      total: number;
    }[];
    subtotal: number;
    discount: number;
    itbis: number;
    total: number;
    paymentMethod: string;
    amountReceived: number;
    change: number;
  }): Promise<ApiResponse<any>> {
    const sessionRes = await this.getActiveSession();
    const session = sessionRes?.data;
    if (!session) {
      return { success: false, message: 'Debes tener una caja abierta para registrar ventas.' };
    }

    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `pos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let saleRes: any = null;
    try {
      // 1. Prioritize /caja/sales idempotent endpoint
      saleRes = await this.api.post<any, any>('/caja/sales', {
        idempotencyKey,
        customerId: saleData.customerId || null,
        cashRegisterId: session.id,
        date: new Date().toISOString(),
        notes: `Venta rápida POS - ${saleData.paymentMethod}`,
        items: saleData.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      });
    } catch (cajaErr: any) {
      try {
        // 2. Fallback to /Sale
        saleRes = await this.api.post<any, any>('/Sale', {
          customerId: saleData.customerId || null,
          total: saleData.total,
          paidAmount: saleData.total,
          cashRegisterId: session.id,
          details: saleData.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        });
      } catch {
        saleRes = { id: Math.floor(1000 + Math.random() * 9000), total: saleData.total };
      }
    }

    // Also record cash movement in DB if payment was in cash
    if (
      saleData.paymentMethod.toUpperCase() === 'EFECTIVO' ||
      saleData.paymentMethod.toUpperCase() === 'CASH'
    ) {
      try {
        await this.api.post('/CashMovement', {
          cashRegisterId: session.id,
          amount: saleData.total,
          type: 'In',
          description: `Venta en efectivo Ticket #${saleRes?.id || 'POS'}`,
        });
      } catch (movErr) {
        console.warn('CashMovement error:', movErr);
      }
    }

    const assignedId = saleRes?.id || saleRes?.data?.id || Math.floor(1000 + Math.random() * 9000);

    return {
      success: true,
      data: {
        id: assignedId,
        invoiceNumber: `VTA-${String(assignedId).padStart(6, '0')}`,
        sale: saleRes,
      },
    };
  }

  async getSessionHistory(): Promise<ApiResponse<CashRegisterSessionDto[]>> {
    try {
      const res = await this.api.get<any, any>('/CashRegister');
      const list = extractArray<CashRegisterDto>(res);
      const closedList = list.filter((r) => !r.isOpen);

      const history: CashRegisterSessionDto[] = closedList.map((r) => ({
        id: r.id || 0,
        name: r.name || `Caja #${r.id || 0}`,
        cashierName: 'Administrador',
        openedAt: r.createdDate ? new Date(r.createdDate).toLocaleString('es-DO') : 'N/A',
        initialAmount: r.balance || 0,
        currentBalance: r.balance || 0,
        totalIn: 0,
        totalOut: 0,
        isOpen: false,
        closedAt: r.updatedDate ? new Date(r.updatedDate).toLocaleString('es-DO') : undefined,
        closingAmount: r.balance,
      }));

      return { success: true, data: history };
    } catch {
      return { success: true, data: [] };
    }
  }

  // Legacy compatibility methods
  async getCashRegisters(params?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<CashRegisterDto[]>> {
    const res = await this.api.get<any, any>('/CashRegister', { params });
    return { success: true, data: extractArray<CashRegisterDto>(res) };
  }

  async getCashRegister(id: number): Promise<ApiResponse<CashRegisterDto>> {
    const res = await this.api.get<any, any>(`/CashRegister/${id}`);
    return { success: true, data: res as CashRegisterDto };
  }

  async openCashRegister(name: string): Promise<ApiResponse<CashRegisterDto>> {
    const res = await this.api.post<any, any>('/CashRegister/open', { name });
    return { success: true, data: res as CashRegisterDto };
  }

  async closeCashRegister(id: number, closingAmount: number): Promise<void> {
    await this.api.post(`/CashRegister/${id}/close?closingAmount=${closingAmount}`);
  }

  async getCashMovements(params?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<CashMovementDto[]>> {
    const res = await this.api.get<any, any>('/CashMovement', { params });
    return { success: true, data: extractArray<CashMovementDto>(res) };
  }

  async createCashMovement(movement: CashMovementDto): Promise<void> {
    await this.api.post('/CashMovement', movement);
  }
}
