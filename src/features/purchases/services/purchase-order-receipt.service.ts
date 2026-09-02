import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import { StockService } from '../../inventory/services/stock.service';
import { WarehouseService } from '../../inventory/services/warehouse.service';
import type { ApiResponse } from '../../cuadreEnv/types/api';
import type {
  PurchaseOrder,
  PurchaseOrderReceipt,
} from '../../../app/models/purchase-order';

const PURCHASE_ORDERS_STORAGE_KEY = 'cuadreenv_purchase_orders_db';
const RECEIPTS_STORAGE_KEY = 'cuadreenv_po_receipts_db';

const DEFAULT_ORDERS: PurchaseOrder[] = [
  {
    id: 101,
    orderNumber: 'OC-000101',
    prefix: 'OC',
    supplierId: 1,
    supplierName: 'Distribuidora Nacional C. por A.',
    supplierRnc: '1-01-23456-7',
    warehouseId: 1,
    warehouseName: 'Almacén Principal Central',
    orderDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    expectedDeliveryDate: new Date().toISOString(),
    statusId: 1, // Creada
    statusName: 'Pendiente de Recepción',
    notes: 'Pedido mensual de bebidas y productos de alta rotación',
    subTotal: 45000,
    itbis: 8100,
    total: 53100,
    productDetails: [
      {
        productId: 1,
        barCode: '74210001',
        productName: 'Coca Cola 2L Regular',
        quantityOrdered: 50,
        quantityReceived: 0,
        unitCost: 80,
        subTotal: 4000,
        itbis: 720,
        total: 4720,
      },
      {
        productId: 2,
        barCode: '74210002',
        productName: 'Arroz Premium 10lb',
        quantityOrdered: 30,
        quantityReceived: 0,
        unitCost: 350,
        subTotal: 10500,
        itbis: 0,
        total: 10500,
      },
      {
        productId: 3,
        barCode: '74210003',
        productName: 'Aceite Vegetal 64oz',
        quantityOrdered: 40,
        quantityReceived: 0,
        unitCost: 220,
        subTotal: 8800,
        itbis: 1584,
        total: 10384,
      },
    ],
  },
  {
    id: 102,
    orderNumber: 'OC-000102',
    prefix: 'OC',
    supplierId: 2,
    supplierName: 'Importadora del Caribe S.R.L.',
    supplierRnc: '1-30-98765-4',
    warehouseId: 1,
    warehouseName: 'Almacén Principal Central',
    orderDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    expectedDeliveryDate: new Date().toISOString(),
    statusId: 3, // Completada
    statusName: 'Completada',
    notes: 'Recepción total procesada',
    subTotal: 18000,
    itbis: 3240,
    total: 21240,
    productDetails: [
      {
        productId: 4,
        barCode: '74210004',
        productName: 'Leche Entera 1L (Caja 12)',
        quantityOrdered: 20,
        quantityReceived: 20,
        unitCost: 900,
        subTotal: 18000,
        itbis: 3240,
        total: 21240,
      },
    ],
  },
];

@Injectable({
  providedIn: 'root',
})
export class PurchaseOrderReceiptService {
  private api = inject(ApiClientService);
  private stockService = inject(StockService);
  private warehouseService = inject(WarehouseService);

  private getLocalOrders(): PurchaseOrder[] {
    try {
      const raw = localStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY);
      if (!raw) {
        this.saveLocalOrders(DEFAULT_ORDERS);
        return DEFAULT_ORDERS;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_ORDERS;
    }
  }

  private saveLocalOrders(list: PurchaseOrder[]): void {
    try {
      localStorage.setItem(PURCHASE_ORDERS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local orders:', e);
    }
  }

  private getLocalReceipts(): PurchaseOrderReceipt[] {
    try {
      const raw = localStorage.getItem(RECEIPTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalReceipts(list: PurchaseOrderReceipt[]): void {
    try {
      localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local receipts:', e);
    }
  }

  async getPurchaseOrders(): Promise<ApiResponse<PurchaseOrder[]>> {
    try {
      const res = await this.api.get<any, any>('/PurchaseOrder');
      const list = extractArray<PurchaseOrder>(res);
      if (list && list.length > 0) return { success: true, data: list };
    } catch {
      // fallback
    }
    return { success: true, data: this.getLocalOrders() };
  }

  async getPurchaseOrder(id: number): Promise<ApiResponse<PurchaseOrder>> {
    const list = this.getLocalOrders();
    const found = list.find((o) => o.id === id);
    if (found) return { success: true, data: found };
    return { success: false, message: 'Orden de compra no encontrada.' };
  }

  existsReceiptOrRequest(purchaseOrderId: number): Observable<boolean> {
    const list = this.getLocalOrders();
    const po = list.find((o) => o.id === purchaseOrderId);
    if (!po) return of(false);

    // If already fully completed
    if (po.statusId === 3) {
      return of(true);
    }

    // Check if there is a pending receipt
    const receipts = this.getLocalReceipts();
    const exists = receipts.some(
      (r) => r.purchaseOrderId === purchaseOrderId && (r.statusId === 1 || r.statusId === 2),
    );

    return of(exists);
  }

  async getReceipts(): Promise<ApiResponse<PurchaseOrderReceipt[]>> {
    try {
      const res = await this.api.get<any, any>('/PurchaseOrderReceipt');
      const list = extractArray<PurchaseOrderReceipt>(res);
      if (list && list.length > 0) return { success: true, data: list };
    } catch {
      // fallback
    }
    return { success: true, data: this.getLocalReceipts() };
  }

  async createReceipt(receipt: Partial<PurchaseOrderReceipt>): Promise<ApiResponse<PurchaseOrderReceipt>> {
    const id = Date.now();
    const receiptNum = `REC-${String(id).slice(-6)}`;
    const orders = this.getLocalOrders();
    const poIndex = orders.findIndex((o) => o.id === receipt.purchaseOrderId);

    const newReceipt: PurchaseOrderReceipt = {
      id,
      receiptNumber: receiptNum,
      prefix: 'REC',
      purchaseOrderId: receipt.purchaseOrderId || 0,
      purchaseOrderNumber: receipt.purchaseOrderNumber || `OC-${receipt.purchaseOrderId}`,
      warehouseId: receipt.warehouseId || 1,
      warehouseName: receipt.warehouseName || 'Almacén Principal Central',
      supplierId: receipt.supplierId || 1,
      supplierName: receipt.supplierName || 'Proveedor',
      receiptDate: new Date().toISOString(),
      statusId: receipt.statusId || 1,
      statusName: receipt.statusId === 2 ? 'En Revisión (Manage Request)' : 'Aplicado',
      comments: receipt.comments || '',
      hasDiscrepancies: receipt.hasDiscrepancies || false,
      productDetails: receipt.productDetails || [],
    };

    // If directly applied, increment stock and update purchase order lines
    if (newReceipt.statusId === 1) {
      for (const item of newReceipt.productDetails) {
        if (item.quantityReceived > 0) {
          await this.stockService.updateStock(
            newReceipt.warehouseId,
            item.productId,
            item.quantityReceived,
            item.productName,
            item.barCode,
          );
        }
      }

      // Update PO status
      if (poIndex !== -1) {
        const po = orders[poIndex];
        po.productDetails.forEach((line) => {
          const received = newReceipt.productDetails.find((r) => r.productId === line.productId);
          if (received) {
            line.quantityReceived += received.quantityReceived;
          }
        });
        const allCompleted = po.productDetails.every((line) => line.quantityReceived >= line.quantityOrdered);
        po.statusId = allCompleted ? 3 : 2; // 3: Completada, 2: Parcial
        po.statusName = allCompleted ? 'Completada' : 'Recepción Parcial';
        this.saveLocalOrders(orders);
      }
    }

    const receipts = this.getLocalReceipts();
    receipts.unshift(newReceipt);
    this.saveLocalReceipts(receipts);

    return {
      success: true,
      data: newReceipt,
      message: `Recepción ${receiptNum} generada exitosamente.`,
    };
  }
}
