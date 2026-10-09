import { Injectable, signal, computed } from '@angular/core';

export interface PosDraftItem {
  productId: number;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface PosSaleDraft {
  id?: string;
  label?: string;
  customerId: number | null;
  customerName?: string;
  items: PosDraftItem[];
  discountType: 'percent' | 'fixed';
  discountValue: number;
  selectedMethod: string;
  amountReceived: number;
  cardLastFour?: string;
  cardAuthVoucher?: string;
  transferBank?: string;
  transferReference?: string;
  timestamp: string;
  companyId?: number | null;
}

export interface PosHeldSale extends PosSaleDraft {
  id: string;
  heldAt: string;
  totalAmount: number;
  itemCount: number;
}

const ACTIVE_DRAFT_KEY = 'cuadre_pos_active_draft';
const HELD_SALES_PREFIX = 'cuadre_pos_held_sales_';

@Injectable({
  providedIn: 'root',
})
export class PosDraftStorageService {
  private heldSalesSignal = signal<PosHeldSale[]>([]);

  readonly heldSales = computed(() => this.heldSalesSignal());
  readonly heldCount = computed(() => this.heldSalesSignal().length);

  constructor() {
    this.reloadHeldSales();
  }

  private getHeldKey(): string {
    const compId = typeof window !== 'undefined' && window.localStorage
      ? localStorage.getItem('companyId') || 'default'
      : 'default';
    return `${HELD_SALES_PREFIX}${compId}`;
  }

  reloadHeldSales(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(this.getHeldKey());
      if (raw) {
        const parsed: PosHeldSale[] = JSON.parse(raw);
        this.heldSalesSignal.set(Array.isArray(parsed) ? parsed : []);
      } else {
        this.heldSalesSignal.set([]);
      }
    } catch {
      this.heldSalesSignal.set([]);
    }
  }

  // ==========================================
  // Emergency Draft Preservation (JWT 401 / Unload)
  // ==========================================

  saveActiveDraft(draft: PosSaleDraft): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      if (draft.items.length === 0) {
        this.clearActiveDraft();
        return;
      }
      draft.timestamp = new Date().toISOString();
      sessionStorage.setItem(ACTIVE_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn('[PosDraftStorage] Error saving active draft:', e);
    }
  }

  hasActiveDraft(): boolean {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    return !!sessionStorage.getItem(ACTIVE_DRAFT_KEY);
  }

  getActiveDraft(): PosSaleDraft | null {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
      const raw = sessionStorage.getItem(ACTIVE_DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PosSaleDraft;
    } catch {
      return null;
    }
  }

  clearActiveDraft(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      sessionStorage.removeItem(ACTIVE_DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  // ==========================================
  // Held Carts (Ventas en espera)
  // ==========================================

  holdSale(draft: PosSaleDraft, customLabel?: string): PosHeldSale {
    const id = 'HELD-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const totalAmount = draft.items.reduce((sum, it) => sum + it.total, 0);
    const label = customLabel || draft.customerName || `Venta en espera #${this.heldCount() + 1}`;

    const heldSale: PosHeldSale = {
      ...draft,
      id,
      label,
      heldAt: new Date().toISOString(),
      totalAmount,
      itemCount: draft.items.reduce((sum, it) => sum + it.quantity, 0),
    };

    const current = [...this.heldSalesSignal(), heldSale];
    this.heldSalesSignal.set(current);
    this.persistHeldSales(current);
    return heldSale;
  }

  resumeHeldSale(id: string): PosHeldSale | null {
    const current = this.heldSalesSignal();
    const found = current.find((s) => s.id === id);
    if (!found) return null;

    const remaining = current.filter((s) => s.id !== id);
    this.heldSalesSignal.set(remaining);
    this.persistHeldSales(remaining);
    return found;
  }

  removeHeldSale(id: string): void {
    const remaining = this.heldSalesSignal().filter((s) => s.id !== id);
    this.heldSalesSignal.set(remaining);
    this.persistHeldSales(remaining);
  }

  private persistHeldSales(sales: PosHeldSale[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(this.getHeldKey(), JSON.stringify(sales));
    } catch (e) {
      console.warn('[PosDraftStorage] Error persisting held sales:', e);
    }
  }
}
