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
const MOVEMENTS_STORAGE_KEY = 'app_cash_register_movements';
const SESSION_HISTORY_STORAGE_KEY = 'app_cash_register_session_history';

@Injectable({
  providedIn: 'root',
})
export class CashRegisterService {
  private inMemorySession: CashRegisterSessionDto | null = null;
  private inMemoryMovements: CashRegisterMovementItem[] | null = null;
  private inMemoryHistory: CashRegisterSessionDto[] | null = null;

  constructor(private api: ApiClientService = inject(ApiClientService, { optional: true }) as any) {}

  // Local Store helpers
  private getStoredActiveSession(): CashRegisterSessionDto | null {
    if (this.inMemorySession !== null) {
      return this.inMemorySession;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (raw) {
          this.inMemorySession = JSON.parse(raw);
          return this.inMemorySession;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  private saveStoredActiveSession(session: CashRegisterSessionDto | null): void {
    this.inMemorySession = session;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (session) {
          window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
        } else {
          window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        }
      }
    } catch {
      // ignore
    }
  }

  private getStoredMovements(): CashRegisterMovementItem[] {
    if (this.inMemoryMovements !== null) {
      return this.inMemoryMovements;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(MOVEMENTS_STORAGE_KEY);
        if (raw) {
          const parsed: CashRegisterMovementItem[] = JSON.parse(raw);
          this.inMemoryMovements = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    this.inMemoryMovements = [];
    return this.inMemoryMovements;
  }

  private saveStoredMovements(movements: CashRegisterMovementItem[]): void {
    this.inMemoryMovements = movements;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(movements));
      }
    } catch {
      // ignore
    }
  }

  private getStoredHistory(): CashRegisterSessionDto[] {
    if (this.inMemoryHistory !== null) {
      return this.inMemoryHistory;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(SESSION_HISTORY_STORAGE_KEY);
        if (raw) {
          const parsed: CashRegisterSessionDto[] = JSON.parse(raw);
          this.inMemoryHistory = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    this.inMemoryHistory = [];
    return this.inMemoryHistory;
  }

  private saveStoredHistory(history: CashRegisterSessionDto[]): void {
    this.inMemoryHistory = history;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify(history));
      }
    } catch {
      // ignore
    }
  }

  // Active Session & Lifecycle
  async getActiveSession(): Promise<ApiResponse<CashRegisterSessionDto | null>> {
    let session = this.getStoredActiveSession();

    // Check backend registers if no local session found
    if (!session) {
      try {
        const regRes = await this.api.get<any, any>('/CashRegister');
        const list = extractArray<CashRegisterDto>(regRes);
        const openReg = list.find((r) => r.isOpen);
        if (openReg) {
          session = {
            id: openReg.id || 1,
            name: openReg.name || 'Caja Principal',
            cashierName: 'Administrador',
            openedAt: new Date().toLocaleString('es-DO'),
            initialAmount: openReg.balance || 10000,
            currentBalance: openReg.balance || 10000,
            totalIn: 0,
            totalOut: 0,
            isOpen: true,
          };
          this.saveStoredActiveSession(session);
        }
      } catch {
        // use local
      }
    }

    return { success: true, data: session };
  }

  async openSession(params: {
    name?: string;
    initialAmount: number;
    cashierName?: string;
    notes?: string;
  }): Promise<ApiResponse<CashRegisterSessionDto>> {
    const regName = params.name?.trim() || 'Caja Principal';
    const initialAmt = Number(params.initialAmount) || 0;
    const now = new Date();
    const formattedDate = now.toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let backendId = 1;
    try {
      const res = await this.api.post<any, any>('/CashRegister/open', { name: regName });
      if (res?.id) backendId = res.id;
    } catch {
      // fallback to timestamp id
      backendId = Date.now();
    }

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

    // Initial movement for opening
    const initialMovement: CashRegisterMovementItem = {
      id: 1,
      date: formattedDate,
      rawDate: now.toISOString(),
      type: 'Saldo inicial',
      category: 'Apertura',
      description: 'Apertura de caja' + (params.notes ? ` (${params.notes})` : ''),
      inAmount: initialAmt,
      outAmount: null,
      balance: initialAmt,
      paymentMethod: 'Efectivo',
    };

    this.saveStoredActiveSession(session);
    this.saveStoredMovements([initialMovement]);

    return { success: true, data: session };
  }

  async closeSession(params: {
    closingAmount: number;
    notes?: string;
  }): Promise<ApiResponse<{ expected: number; actual: number; diff: number }>> {
    const session = this.getStoredActiveSession();
    if (!session) {
      return { success: false, message: 'No hay una sesión de caja abierta actualmente.' };
    }

    const now = new Date();
    const formattedDate = now.toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const expected = session.currentBalance;
    const actual = Number(params.closingAmount) || 0;
    const diff = actual - expected;

    // Update session object
    session.isOpen = false;
    session.closedAt = formattedDate;
    session.closingAmount = actual;
    session.expectedAmount = expected;
    session.difference = diff;
    session.closingNotes = params.notes || null;

    // Save to historical sessions
    const history = this.getStoredHistory();
    history.unshift(session);
    this.saveStoredHistory(history);

    // Call backend API if possible
    try {
      await this.api.post(`/CashRegister/${session.id}/close?closingAmount=${actual}`);
    } catch {
      // ignore
    }

    // Clear active session
    this.saveStoredActiveSession(null);

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
    const movements = this.getStoredMovements();
    return { success: true, data: movements };
  }

  async addMovement(item: {
    type: 'Entrada' | 'Salida';
    category: 'Ventas' | 'Cobros' | 'Ingresos' | 'Compras' | 'Gastos' | 'Retiro' | 'Ajuste';
    description: string;
    amount: number;
    paymentMethod?: string;
    reference?: string | null;
  }): Promise<ApiResponse<CashRegisterMovementItem>> {
    const session = this.getStoredActiveSession();
    if (!session) {
      return { success: false, message: 'No hay una caja abierta para registrar movimientos.' };
    }

    const amt = Number(item.amount);
    if (amt <= 0) {
      return { success: false, message: 'El monto debe ser mayor a cero.' };
    }

    const now = new Date();
    const formattedDate = now.toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let newBalance = session.currentBalance;
    if (item.type === 'Entrada') {
      newBalance += amt;
      session.totalIn += amt;
    } else {
      newBalance = Math.max(0, newBalance - amt);
      session.totalOut += amt;
    }
    session.currentBalance = newBalance;

    const movements = this.getStoredMovements();
    const newMovement: CashRegisterMovementItem = {
      id: movements.length + 1,
      date: formattedDate,
      rawDate: now.toISOString(),
      type: item.type,
      category: item.category,
      description: item.description,
      inAmount: item.type === 'Entrada' ? amt : null,
      outAmount: item.type === 'Salida' ? amt : null,
      balance: newBalance,
      paymentMethod: item.paymentMethod || 'Efectivo',
      reference: item.reference || null,
    };

    movements.push(newMovement);
    this.saveStoredMovements(movements);
    this.saveStoredActiveSession(session);

    // Sync with backend CashMovement if available
    try {
      await this.api.post('/CashMovement', {
        cashRegisterId: session.id,
        amount: amt,
        type: item.type === 'Entrada' ? 'In' : 'Out',
        description: `${item.category}: ${item.description}`,
      });
    } catch {
      // ignore
    }

    return { success: true, data: newMovement };
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
    const session = this.getStoredActiveSession();
    if (!session) {
      return { success: false, message: 'Debes tener una caja abierta para registrar ventas.' };
    }

    const saleNum = Math.floor(100000 + Math.random() * 900000);
    const invoiceNumber = `INV-${saleNum}`;
    const desc = `Venta en ${saleData.paymentMethod.toLowerCase()} ${invoiceNumber}`;

    // Add movement to cash register
    const movementRes = await this.addMovement({
      type: 'Entrada',
      category: 'Ventas',
      description: desc,
      amount: saleData.total,
      paymentMethod: saleData.paymentMethod,
      reference: invoiceNumber,
    });

    // Try posting sale to backend /Sale
    try {
      await this.api.post('/Sale', {
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
      // ignore backend error for quick resilience
    }

    return {
      success: true,
      data: {
        invoiceNumber,
        movement: movementRes.data,
      },
    };
  }

  async getSessionHistory(): Promise<ApiResponse<CashRegisterSessionDto[]>> {
    const history = this.getStoredHistory();
    return { success: true, data: history };
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
