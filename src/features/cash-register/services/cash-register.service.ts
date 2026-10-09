import { Injectable, inject, Optional } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import {
  CashRegisterDto,
  CashMovementDto,
  ApiResponse,
} from '../../cuadreEnv/types/api';
import { logger } from '../../cuadreEnv/services/logger.service';
import { RealtimeAlertService } from '../../cuadreEnv/services/realtime-alert.service';

export interface CashRegisterSessionDto {
  id: number;
  name: string;
  cashierName: string;
  cashierId?: number | null;
  openedAt: string;
  initialAmount: number;
  currentBalance: number;
  totalIn: number;
  totalOut: number;
  isOpen: boolean;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
  pauseReason?: string | null;
  pauseNotes?: string | null;
  pausedAt?: string | null;
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
const CLOSED_REGISTERS_STORAGE_KEY = 'cuadreenv_closed_cash_registers';

function getClosedRegisterIds(): number[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CLOSED_REGISTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markRegisterAsClosed(id: number) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const closed = getClosedRegisterIds();
    if (!closed.includes(id)) {
      closed.push(id);
      window.localStorage.setItem(CLOSED_REGISTERS_STORAGE_KEY, JSON.stringify(closed));
    }
  } catch {
    // ignore
  }
}

function unmarkRegisterAsClosed(id: number) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const closed = getClosedRegisterIds().filter((cId) => cId !== id);
    window.localStorage.setItem(CLOSED_REGISTERS_STORAGE_KEY, JSON.stringify(closed));
  } catch {
    // ignore
  }
}

@Injectable({
  providedIn: 'root',
})
export class CashRegisterService {
  private realtimeAlertService?: RealtimeAlertService;

  constructor(
    private api: ApiClientService = inject(ApiClientService, { optional: true }) as any,
    @Optional() realtimeAlertService?: RealtimeAlertService
  ) {
    if (realtimeAlertService) {
      this.realtimeAlertService = realtimeAlertService;
    } else {
      try {
        this.realtimeAlertService = inject(RealtimeAlertService, { optional: true }) ?? undefined;
      } catch {
        // Outside Angular injection context (e.g. unit tests)
      }
    }
  }

  // Helper to read stored session
  private getStoredSession(): CashRegisterSessionDto | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {
        // ignore JSON parse error
      }
    }
    return null;
  }

  // Active Session & Lifecycle directly against DB
  // Active Session & Lifecycle directly against DB
  async getActiveSession(): Promise<ApiResponse<CashRegisterSessionDto | null>> {
    const stored = this.getStoredSession();
    const closedIds = getClosedRegisterIds();

    // 1. Probar ruta canónica GET /v1/cash-sessions/active-session
    try {
      const canonicalRes = await this.api.get<any, any>('/cash-sessions/active-session');
      const data = canonicalRes?.data || canonicalRes;
      if (data && (data.id || data.isOpen)) {
        const session: CashRegisterSessionDto = {
          id: data.id || 1,
          name: data.name || stored?.name || 'Caja Principal',
          cashierName: data.cashierName || stored?.cashierName || 'Cajero',
          cashierId: data.cashierId || stored?.cashierId || null,
          openedAt: data.openedAt || stored?.openedAt || new Date().toLocaleString('es-DO'),
          initialAmount: data.initialAmount ?? (stored?.initialAmount || 0),
          currentBalance: data.currentBalance ?? (data.initialAmount || 0),
          totalIn: data.totalIn || 0,
          totalOut: data.totalOut || 0,
          isOpen: data.isOpen !== false,
          status: data.status || 'OPEN',
          pauseReason: data.pauseReason || null,
          pauseNotes: data.pauseNotes || null,
          pausedAt: data.pausedAt || null,
        };

        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
        }

        return { success: true, data: session };
      }
    } catch {
      // Fallback a listado de /CashRegister
    }

    try {
      let regRes: any;
      try {
        regRes = await this.api.get<any, any>('/CashRegister');
      } catch {
        regRes = await this.api.get<any, any>('/cash-register');
      }
      const list = extractArray<CashRegisterDto>(regRes);
      const openReg = list.find((r) => r.isOpen && (r.id != null ? !closedIds.includes(r.id) : true));

      if (openReg) {
        // Fetch real movements from DB to calculate balance & totals
        const movRes = await this.api.get<any, any>('/CashMovement', {
          params: { cashRegisterId: openReg.id },
        });
        const movList = extractArray<CashMovementDto>(movRes);

        let totalIn = 0;
        let totalOut = 0;
        const initial = (stored && stored.id === openReg.id && stored.initialAmount !== undefined)
          ? stored.initialAmount
          : (openReg.balance || 0);

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
          name: openReg.name || stored?.name || 'Caja Principal',
          cashierName: stored?.cashierName || (openReg as any).cashierName || 'Cajero',
          cashierId: stored?.cashierId || (openReg as any).cashierId || null,
          openedAt: stored?.openedAt || (openReg.createdDate
            ? new Date(openReg.createdDate).toLocaleString('es-DO')
            : new Date().toLocaleString('es-DO')),
          initialAmount: initial,
          currentBalance,
          totalIn,
          totalOut,
          isOpen: true,
          status: stored?.status || 'OPEN',
          pauseReason: stored?.pauseReason || null,
          pauseNotes: stored?.pauseNotes || null,
          pausedAt: stored?.pausedAt || null,
        };

        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
        }

        return { success: true, data: session };
      }
    } catch {
      return { success: false, data: null, message: 'Servidor no disponible.' };
    }

    // If backend answered cleanly and no open register found in DB
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
    return { success: true, data: null };
  }

  async openSession(params: {
    name?: string;
    initialAmount: number;
    cashierName?: string;
    cashierId?: number | null;
    notes?: string;
  }): Promise<ApiResponse<CashRegisterSessionDto>> {
    const regName = params.name?.trim() || 'Caja Principal';
    const initialAmt = Number(params.initialAmount) || 0;

    // Regla: No enviar companyId en el body; el backend lo toma del claim companyId del JWT
    let backendId = 1;
    try {
      const canonicalOpen = await this.api.post<any, any>('/cash-sessions/open', {
        name: regName,
        initialAmount: initialAmt,
        cashierName: params.cashierName || 'Cajero',
        cashierId: params.cashierId || null,
        notes: params.notes || '',
      });
      backendId = canonicalOpen?.data?.id || canonicalOpen?.id || 1;
    } catch {
      const res = await this.api.post<any, any>('/CashRegister/open', {
        name: regName,
        balance: initialAmt,
      });
      backendId = res?.id || 1;
    }

    unmarkRegisterAsClosed(backendId);
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
      cashierName: params.cashierName || 'Cajero',
      cashierId: params.cashierId || null,
      openedAt: formattedDate,
      initialAmount: initialAmt,
      currentBalance: initialAmt,
      totalIn: 0,
      totalOut: 0,
      isOpen: true,
      status: 'OPEN',
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
    }

    logger.info(`Caja "${regName}" aperturada por ${params.cashierName || 'Cajero'}. Fondo Inicial: RD$ ${initialAmt}`, 'Caja Registradora', { cashierId: params.cashierId });

    return { success: true, data: session };
  }

  async pauseSession(reason: string, notes?: string): Promise<ApiResponse<CashRegisterSessionDto>> {
    const sessionRes = await this.getActiveSession();
    const session = sessionRes?.data;
    if (!session) {
      return { success: false, message: 'No hay una sesión de caja activa para pausar.' };
    }

    const now = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
    const updatedSession: CashRegisterSessionDto = {
      ...session,
      status: 'PAUSED',
      pauseReason: reason,
      pauseNotes: notes || null,
      pausedAt: now,
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
    }

    logger.info(`Caja "${session.name}" pausada. Motivo: ${reason}`, 'Caja Registradora', { notes });

    return { success: true, data: updatedSession };
  }

  async resumeSession(): Promise<ApiResponse<CashRegisterSessionDto>> {
    const sessionRes = await this.getActiveSession();
    const session = sessionRes?.data;
    if (!session) {
      return { success: false, message: 'No hay una sesión de caja para reanudar.' };
    }

    const updatedSession: CashRegisterSessionDto = {
      ...session,
      status: 'OPEN',
      pauseReason: null,
      pauseNotes: null,
      pausedAt: null,
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
    }

    logger.info(`Caja "${session.name}" reanudada tras pausa.`, 'Caja Registradora');

    return { success: true, data: updatedSession };
  }

  async closeSession(params: {
    closingAmount: number;
    declaredCards?: number;
    declaredTransfers?: number;
    notes?: string;
    denominations?: any;
    supervisorUserId?: number;
    supervisorPin?: string;
  }): Promise<ApiResponse<{ expected: number; actual: number; diff: number; status: 'EXACT' | 'SHORTAGE' | 'SURPLUS'; isBalanced?: boolean; isOutOfTolerance?: boolean; requiresSupervisorAuth?: boolean }>> {
    const sessionRes = await this.getActiveSession();
    const session = sessionRes?.data;
    if (!session) {
      return { success: false, message: 'No hay una sesión de caja abierta actualmente.' };
    }

    const actual = Number(params.closingAmount) || 0;
    const registerId = session.id;

    const breakdownStr = params.denominations
      ? (typeof params.denominations === 'string' ? params.denominations : JSON.stringify(params.denominations))
      : null;

    // Payload canónico esperado por el backend .NET CashRegisterController: CloseCashRegisterRequest(decimal ActualAmount, string? BreakdownJson)
    const backendClosePayload = {
      actualAmount: actual,
      breakdownJson: breakdownStr,
    };

    const canonicalClosePayload = {
      actualAmount: actual,
      countedCash: actual,
      denominationBreakdown: params.denominations,
      breakdownJson: breakdownStr,
      supervisorPin: params.supervisorPin,
      closingComment: params.notes || '',
      declaredCash: actual,
      declaredCards: params.declaredCards || 0,
      declaredTransfers: params.declaredTransfers || 0,
    };

    let apiRes: any = null;
    let lastError: any = null;

    // 1. Intentar endpoint principal .NET: POST /v1/CashRegister/{id}/close
    try {
      apiRes = await this.api.post<any, any>(`/CashRegister/${registerId}/close`, backendClosePayload);
    } catch (err1: any) {
      lastError = err1;
      // 2. Fallback a ruta /cash-sessions/{id}/close
      try {
        apiRes = await this.api.post<any, any>(`/cash-sessions/${registerId}/close`, canonicalClosePayload);
      } catch (err2: any) {
        lastError = err2;
        // 3. Fallback a /caja/sessions/{id}/close
        try {
          apiRes = await this.api.post<any, any>(`/caja/sessions/${registerId}/close`, {
            ...backendClosePayload,
            ...canonicalClosePayload,
            cashRegisterId: registerId,
            sessionId: registerId,
          });
        } catch (err3: any) {
          lastError = err3;
        }
      }
    }

    if (!apiRes && lastError) {
      const errMsg =
        lastError?.response?.data?.message ||
        lastError?.response?.data?.error ||
        lastError?.message ||
        'Error al procesar el cierre de caja en el servidor.';
      logger.error(`Error al cerrar caja: ${errMsg}`, 'Caja Registradora', { error: lastError });
      return {
        success: false,
        message: errMsg,
      };
    }

    const data = apiRes?.data || apiRes || {};
    const expected = data.expectedAmount ?? data.expected ?? session.currentBalance;
    const diff = data.difference ?? data.diff ?? (Math.round((actual - expected) * 100) / 100);
    const isBalanced = Math.abs(diff) < 0.01;
    const isOutOfTolerance = Math.abs(diff) > 50; // Umbral de tolerancia de caja RD$ 50

    let status: 'EXACT' | 'SHORTAGE' | 'SURPLUS' = data.status || 'EXACT';
    if (!data.status) {
      if (diff < -0.01) status = 'SHORTAGE';
      else if (diff > 0.01) status = 'SURPLUS';
      else status = 'EXACT';
    }

    markRegisterAsClosed(session.id);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }

    logger.info(`Caja "${session.name}" cerrada exitosamente. Esperado: RD$ ${expected}, Físico: RD$ ${actual}, Diferencia: RD$ ${diff}`, 'Caja Registradora', { notes: params.notes });

    return {
      success: true,
      data: {
        expected,
        actual,
        diff,
        status,
        isBalanced,
        isOutOfTolerance,
        requiresSupervisorAuth: data.requiresSupervisorAuth || false,
      },
      message: 'Arqueo de caja procesado y sesión cerrada exitosamente.',
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

    // Auditoría de Seguridad en Tiempo Real (SignalR / BroadcastHub)
    if (item.type === 'Salida' && amt >= 5000) {
      this.realtimeAlertService?.triggerHighCashDrop(amt, session.name, item.description);
    } else if ((item.category as string) === 'Apertura' || (item.description || '').toLowerCase().includes('sin venta') || (item.description || '').toLowerCase().includes('gaveta')) {
      this.realtimeAlertService?.triggerDrawerOpenedNoSale(session.name, session.cashierName);
    }

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
    idempotencyKey?: string;
  }): Promise<ApiResponse<any>> {
    const sessionRes = await this.getActiveSession();
    const session = sessionRes?.data;
    if (!session) {
      return { success: false, message: 'Debes tener una caja abierta para registrar ventas.' };
    }

    const idempotencyKey =
      saleData.idempotencyKey ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          }));

    let saleRes: any = null;
    try {
      // 1. Prioritize /caja/sales idempotent endpoint with X-Idempotency-Key header
      saleRes = await this.api.post<any, any>(
        '/caja/sales',
        {
          idempotencyKey,
          customerId: saleData.customerId || null,
          cashRegisterId: session.id,
          date: new Date().toISOString(),
          notes: `Venta rápida POS - ${saleData.paymentMethod}`,
          createBy: 'system',
          items: saleData.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        },
        {
          headers: { 'X-Idempotency-Key': idempotencyKey },
        },
      );
    } catch (cajaErr: any) {
      try {
        // 2. Fallback to /Sale
        saleRes = await this.api.post<any, any>(
          '/Sale',
          {
            customerId: saleData.customerId || null,
            total: saleData.total,
            paidAmount: saleData.total,
            cashRegisterId: session.id,
            details: saleData.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            })),
          },
          {
            headers: { 'X-Idempotency-Key': idempotencyKey },
          },
        );
      } catch {
        saleRes = { id: Math.floor(1000 + Math.random() * 9000), total: saleData.total };
      }
    }

    // Also record cash movement in DB if payment was in cash and not a duplicate idempotent replay
    const isIdempotentReplay = Boolean(saleRes?.isExisting || saleRes?.data?.isExisting);
    if (
      !isIdempotentReplay &&
      (saleData.paymentMethod.toUpperCase() === 'EFECTIVO' ||
       saleData.paymentMethod.toUpperCase() === 'CASH')
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

    // Save to local sales cache so SalesComponent (PC) also sees it immediately
    try {
      const localSale: any = {
        id: assignedId,
        customerId: saleData.customerId || null,
        total: saleData.total,
        paidAmount: saleData.amountReceived || saleData.total,
        cashRegisterId: session.id,
        isCancelled: false,
        creationDate: new Date().toISOString(),
        details: saleData.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      };
      const raw = localStorage.getItem('cuadreenv_local_sales_cache');
      const list = raw ? JSON.parse(raw) : [];
      if (!list.some((s: any) => s.id === localSale.id)) {
        list.unshift(localSale);
        localStorage.setItem('cuadreenv_local_sales_cache', JSON.stringify(list));
      }
      // Update session current balance in cache if cash sale
      if (
        saleData.paymentMethod.toUpperCase() === 'EFECTIVO' ||
        saleData.paymentMethod.toUpperCase() === 'CASH'
      ) {
        const storedSess = localStorage.getItem('cuadreenv_active_cash_register_session');
        if (storedSess) {
          const sessObj = JSON.parse(storedSess);
          sessObj.currentBalance = (sessObj.currentBalance || sessObj.initialAmount || 0) + saleData.total;
          sessObj.totalIn = (sessObj.totalIn || 0) + saleData.total;
          localStorage.setItem('cuadreenv_active_cash_register_session', JSON.stringify(sessObj));
        }
      }
    } catch (_) {}

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
        status: 'CLOSED',
        closedAt: r.updatedDate ? new Date(r.updatedDate).toLocaleString('es-DO') : undefined,
        closingAmount: r.balance,
      }));

      return { success: true, data: history };
    } catch {
      return { success: true, data: [] };
    }
  }

  async getCashRegisters(params?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<CashRegisterDto[]>> {
    const validParams = {
      ...params,
      pageSize: params?.pageSize ? Math.min(100, Math.max(1, params.pageSize)) : 100,
    };
    try {
      const res = await this.api.get<any, any>('/CashRegister', { params: validParams });
      const list = extractArray<CashRegisterDto>(res);
      if (list.length > 0) return { success: true, data: list };
    } catch {
      // Fallback
    }
    try {
      const res2 = await this.api.get<any, any>('/cash-register', { params: validParams });
      return { success: true, data: extractArray<CashRegisterDto>(res2) };
    } catch {
      return { success: true, data: [] };
    }
  }

  async getCashRegister(id: number): Promise<ApiResponse<CashRegisterDto>> {
    const res = await this.api.get<any, any>(`/CashRegister/${id}`);
    return { success: true, data: res as CashRegisterDto };
  }

  async openCashRegister(name: string): Promise<ApiResponse<CashRegisterDto>> {
    const res = await this.api.post<any, any>('/CashRegister/open', { name });
    return { success: true, data: res as CashRegisterDto };
  }

  async closeCashRegister(id: number, closingAmount: number, notes?: string): Promise<void> {
    await this.closeSession({ closingAmount, notes });
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
