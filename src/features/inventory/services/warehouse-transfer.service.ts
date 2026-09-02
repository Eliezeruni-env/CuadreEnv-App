import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import { StockService } from './stock.service';
import { WarehouseService } from './warehouse.service';
import { ProductService } from '../../products/services/product.service';
import type { ApiResponse } from '../../cuadreEnv/types/api';
import type { WarehouseTransfer, WarehouseMovementHeader } from '../../../app/models/movement';

const TRANSFERS_STORAGE_KEY = 'cuadreenv_warehouse_transfers_db';

@Injectable({
  providedIn: 'root',
})
export class WarehouseTransferService {
  private api = inject(ApiClientService);
  private stockService = inject(StockService);
  private warehouseService = inject(WarehouseService);
  private productService = inject(ProductService);

  private getLocalTransfers(): WarehouseTransfer[] {
    try {
      const raw = localStorage.getItem(TRANSFERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalTransfers(list: WarehouseTransfer[]): void {
    try {
      localStorage.setItem(TRANSFERS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local warehouse transfers:', e);
    }
  }

  async getTransfers(): Promise<ApiResponse<WarehouseTransfer[]>> {
    try {
      const res = await this.api.get<any, any>('/WarehouseTransfer');
      const list = extractArray<WarehouseTransfer>(res);
      if (list && list.length > 0) {
        return { success: true, data: list };
      }
    } catch {
      // fallback
    }
    return { success: true, data: this.getLocalTransfers() };
  }

  async getTransfer(id: number): Promise<ApiResponse<WarehouseTransfer>> {
    const list = this.getLocalTransfers();
    const found = list.find((t) => t.id === id);
    if (found) return { success: true, data: found };
    return { success: false, message: 'Transferencia no encontrada.' };
  }

  async createTransfer(transfer: WarehouseMovementHeader): Promise<ApiResponse<WarehouseTransfer>> {
    const originId = transfer.warehouseOfOriginId || 1;
    const destinationId = transfer.destinationWarehouseId || 2;

    if (originId === destinationId) {
      return {
        success: false,
        message: 'El almacén de origen no puede ser igual al almacén de destino.',
      };
    }

    // Validate origin stock for each item
    for (const item of transfer.productDetails || []) {
      const pRes = await this.productService.getProduct(item.productId);
      const allowWithoutStock = pRes?.data?.invoiceWithoutStock ?? false;
      const currentStock = await this.stockService.getProductStockInWarehouse(originId, item.productId);

      if (!allowWithoutStock && item.quantity > currentStock) {
        return {
          success: false,
          message: `Stock insuficiente en almacén de origen para "${item.productName}". Disponible: ${currentStock}, Solicitado para transferir: ${item.quantity}.`,
        };
      }
    }

    const id = Date.now();
    const transferNumber = `TRF-${String(id).slice(-6)}`;
    const originRes = await this.warehouseService.getWarehouse(originId);
    const destRes = await this.warehouseService.getWarehouse(destinationId);
    const concepts = this.warehouseService.getConcepts('TRANSFER');
    const concept = concepts.find((c) => c.id === transfer.conceptId);

    const totalQty = (transfer.productDetails || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
    const totalCost = (transfer.productDetails || []).reduce(
      (acc, it) => acc + (it.quantity || 0) * (it.cost || it.price || 0),
      0,
    );

    const newTransfer: WarehouseTransfer = {
      ...transfer,
      id,
      prefix: 'TRF',
      movementNumber: transferNumber,
      type: 'TRANSFER',
      warehouseOfOriginId: originId,
      warehouseOfOriginName: originRes?.data?.name || `Almacén #${originId}`,
      destinationWarehouseId: destinationId,
      destinationWarehouseName: destRes?.data?.name || `Almacén #${destinationId}`,
      conceptName: concept?.name || 'Transferencia Inter-Sucursales',
      createDate: new Date().toISOString(),
      statusId: 1, // Aplicado
      statusName: 'Aplicado',
      totalQuantity: totalQty,
      totalCost: totalCost,
    };

    // 1. Post to API if active
    try {
      await this.api.post<any, any>('/WarehouseTransfer', newTransfer);
    } catch {
      // offline fallback
    }

    // 2. Persist locally
    const currentList = this.getLocalTransfers();
    currentList.unshift(newTransfer);
    this.saveLocalTransfers(currentList);

    // 3. Atomic Stock Update: decrease at origin, increase at destination
    for (const item of transfer.productDetails) {
      await this.stockService.updateStock(
        originId,
        item.productId,
        -item.quantity,
        item.productName,
        item.barCode,
      );
      await this.stockService.updateStock(
        destinationId,
        item.productId,
        item.quantity,
        item.productName,
        item.barCode,
      );
    }

    return {
      success: true,
      data: newTransfer,
      message: `Transferencia ${transferNumber} completada exitosamente. ${totalQty} unidades transferidas de "${newTransfer.warehouseOfOriginName}" a "${newTransfer.destinationWarehouseName}".`,
    };
  }
}
