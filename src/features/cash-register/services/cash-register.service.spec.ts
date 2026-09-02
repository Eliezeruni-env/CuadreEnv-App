import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CashRegisterService } from './cash-register.service';

describe('CashRegisterService', () => {
  let service: CashRegisterService;

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }

    const mockApi: any = {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({ id: 10, success: true }),
      put: vi.fn().mockResolvedValue({ success: true }),
      delete: vi.fn().mockResolvedValue({ success: true }),
    };

    service = new CashRegisterService(mockApi);
  });

  it('should return null when no session has been opened', async () => {
    const sessionRes = await service.getActiveSession();
    expect(sessionRes.success).toBe(true);
    expect(sessionRes.data).toBeNull();
  });

  it('should open a cash register session and initialize with opening movement', async () => {
    const openRes = await service.openSession({
      name: 'Caja Principal 01',
      initialAmount: 10000,
      cashierName: 'Juan Cajero',
      notes: 'Fondo matutino',
    });

    expect(openRes.success).toBe(true);
    expect(openRes.data).toBeDefined();
    expect(openRes.data!.name).toBe('Caja Principal 01');
    expect(openRes.data!.initialAmount).toBe(10000);
    expect(openRes.data!.currentBalance).toBe(10000);
    expect(openRes.data!.isOpen).toBe(true);

    const activeRes = await service.getActiveSession();
    expect(activeRes.data).not.toBeNull();
    expect(activeRes.data!.isOpen).toBe(true);

    const movRes = await service.getMovements();
    expect(movRes.data!.length).toBe(1);
    expect(movRes.data![0].type).toBe('Saldo inicial');
    expect(movRes.data![0].inAmount).toBe(10000);
  });

  it('should register income and expense movements, adjusting the balance', async () => {
    await service.openSession({
      name: 'Caja Principal 01',
      initialAmount: 10000,
    });

    // Add Income
    const incomeRes = await service.addMovement({
      type: 'Entrada',
      category: 'Cobros',
      description: 'Cobro de cliente',
      amount: 3000,
    });
    expect(incomeRes.success).toBe(true);
    expect(incomeRes.data!.balance).toBe(13000);

    // Add Expense
    const expenseRes = await service.addMovement({
      type: 'Salida',
      category: 'Gastos',
      description: 'Gasto de transporte',
      amount: 700,
    });
    expect(expenseRes.success).toBe(true);
    expect(expenseRes.data!.balance).toBe(12300);

    const sessionRes = await service.getActiveSession();
    expect(sessionRes.data!.currentBalance).toBe(12300);
    expect(sessionRes.data!.totalIn).toBe(3000);
    expect(sessionRes.data!.totalOut).toBe(700);
  });

  it('should process quick sales and automatically create cash register entry', async () => {
    await service.openSession({
      name: 'Caja Principal',
      initialAmount: 10000,
    });

    const saleRes = await service.registerQuickSale({
      items: [
        {
          productId: 1,
          productName: 'Producto A',
          unitPrice: 250,
          quantity: 2,
          total: 500,
        },
      ],
      subtotal: 500,
      discount: 0,
      itbis: 90,
      total: 590,
      paymentMethod: 'Efectivo',
      amountReceived: 1000,
      change: 410,
    });

    expect(saleRes.success).toBe(true);
    expect(saleRes.data.invoiceNumber).toBeDefined();

    const sessionRes = await service.getActiveSession();
    expect(sessionRes.data!.currentBalance).toBe(10590);
  });

  it('should close cash register session, calculate discrepancy, and save to history', async () => {
    await service.openSession({
      name: 'Caja Principal',
      initialAmount: 10000,
    });

    await service.addMovement({
      type: 'Entrada',
      category: 'Ventas',
      description: 'Venta',
      amount: 5000,
    });

    // Close with exact match
    const closeRes = await service.closeSession({
      closingAmount: 15000,
      notes: 'Turno finalizado sin faltantes',
    });

    expect(closeRes.success).toBe(true);
    expect(closeRes.data!.expected).toBe(15000);
    expect(closeRes.data!.actual).toBe(15000);
    expect(closeRes.data!.diff).toBe(0);

    // Active session should be null
    const activeRes = await service.getActiveSession();
    expect(activeRes.data).toBeNull();

    // History should contain closed session
    const historyRes = await service.getSessionHistory();
    expect(historyRes.data!.length).toBe(1);
    expect(historyRes.data![0].isOpen).toBe(false);
    expect(historyRes.data![0].closingAmount).toBe(15000);
  });
});
