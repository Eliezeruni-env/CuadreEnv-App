import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import { StockService } from './stock.service';
import { WarehouseService } from './warehouse.service';
import { ProductService } from '../../products/services/product.service';
import type { ApiResponse } from '../../cuadreEnv/types/api';
import type { WarehouseOutlet, WarehouseMovementHeader } from '../../../app/models/movement';

const OUTLETS_STORAGE_KEY = 'cuadreenv_warehouse_outlets_db';

@Injectable({
  providedIn: 'root',
})
export class WarehouseOutletService {
  private api = inject(ApiClientService);
  private stockService = inject(StockService);
  private warehouseService = inject(WarehouseService);
  private productService = inject(ProductService);

  private getLocalOutlets(): WarehouseOutlet[] {
    try {
      const raw = localStorage.getItem(OUTLETS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalOutlets(list: WarehouseOutlet[]): void {
    try {
      localStorage.setItem(OUTLETS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local warehouse outlets:', e);
    }
  }

  async getOutlets(): Promise<ApiResponse<WarehouseOutlet[]>> {
    try {
      const res = await this.api.get<any, any>('/WarehouseOutlet');
      const list = extractArray<WarehouseOutlet>(res);
      if (list && list.length > 0) {
        return { success: true, data: list };
      }
    } catch {
      // fallback
    }
    return { success: true, data: this.getLocalOutlets() };
  }

  async getOutlet(id: number): Promise<ApiResponse<WarehouseOutlet>> {
    const list = this.getLocalOutlets();
    const found = list.find((o) => o.id === id);
    if (found) return { success: true, data: found };
    return { success: false, message: 'Salida de almacén no encontrada.' };
  }

  async createOutlet(outlet: WarehouseMovementHeader): Promise<ApiResponse<WarehouseOutlet>> {
    const whId = outlet.warehouseId || 1;

    // Strict validation: check stock availability for each item
    for (const item of outlet.productDetails || []) {
      const pRes = await this.productService.getProduct(item.productId);
      const allowWithoutStock = pRes?.data?.invoiceWithoutStock ?? false;
      const currentStock = await this.stockService.getProductStockInWarehouse(whId, item.productId);

      if (!allowWithoutStock && item.quantity > currentStock) {
        return {
          success: false,
          message: `Stock insuficiente para "${item.productName}" en el almacén seleccionado. Disponible: ${currentStock}, Solicitado: ${item.quantity}.`,
        };
      }
    }

    const id = Date.now();
    const outletNumber = `SAL-${String(id).slice(-6)}`;
    const whRes = await this.warehouseService.getWarehouse(whId);
    const concepts = this.warehouseService.getConcepts('OUTLET');
    const concept = concepts.find((c) => c.id === outlet.conceptId);

    const totalQty = (outlet.productDetails || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
    const totalCost = (outlet.productDetails || []).reduce(
      (acc, it) => acc + (it.quantity || 0) * (it.cost || it.price || 0),
      0,
    );

    const newOutlet: WarehouseOutlet = {
      ...outlet,
      id,
      prefix: 'SAL',
      movementNumber: outletNumber,
      type: 'OUTLET',
      warehouseName: whRes?.data?.name || `Almacén #${whId}`,
      conceptName: concept?.name || 'Salida de Almacén',
      createDate: new Date().toISOString(),
      statusId: 1, // Aplicado
      statusName: 'Aplicado',
      totalQuantity: totalQty,
      totalCost: totalCost,
    };

    // 1. Post to API if active
    try {
      await this.api.post<any, any>('/WarehouseOutlet', newOutlet);
    } catch {
      // offline fallback
    }

    // 2. Persist locally
    const currentList = this.getLocalOutlets();
    currentList.unshift(newOutlet);
    this.saveLocalOutlets(currentList);

    // 3. Atomically decrease stock in origin warehouse
    for (const item of outlet.productDetails) {
      await this.stockService.updateStock(
        whId,
        item.productId,
        -item.quantity,
        item.productName,
        item.barCode,
      );
    }

    return {
      success: true,
      data: newOutlet,
      message: `Salida ${outletNumber} procesada exitosamente. ${totalQty} unidades descontadas del inventario.`,
    };
  }
}
