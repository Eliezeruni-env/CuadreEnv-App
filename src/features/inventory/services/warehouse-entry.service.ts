import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import { StockService } from './stock.service';
import { WarehouseService } from './warehouse.service';
import type { ApiResponse } from '../../cuadreEnv/types/api';
import type { WarehouseEntry, WarehouseMovementHeader } from '../../../app/models/movement';

const ENTRIES_STORAGE_KEY = 'cuadreenv_warehouse_entries_db';

@Injectable({
  providedIn: 'root',
})
export class WarehouseEntryService {
  private api = inject(ApiClientService);
  private stockService = inject(StockService);
  private warehouseService = inject(WarehouseService);

  private getLocalEntries(): WarehouseEntry[] {
    try {
      const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalEntries(list: WarehouseEntry[]): void {
    try {
      localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local warehouse entries:', e);
    }
  }

  async getEntries(): Promise<ApiResponse<WarehouseEntry[]>> {
    try {
      const res = await this.api.get<any, any>('/WarehouseEntry');
      const list = extractArray<WarehouseEntry>(res);
      if (list && list.length > 0) {
        return { success: true, data: list };
      }
    } catch {
      // fallback
    }
    return { success: true, data: this.getLocalEntries() };
  }

  async getEntry(id: number): Promise<ApiResponse<WarehouseEntry>> {
    const list = this.getLocalEntries();
    const found = list.find((e) => e.id === id);
    if (found) return { success: true, data: found };
    return { success: false, message: 'Entrada de almacén no encontrada.' };
  }

  async createEntry(entry: WarehouseMovementHeader): Promise<ApiResponse<WarehouseEntry>> {
    const id = Date.now();
    const entryNumber = `ENT-${String(id).slice(-6)}`;
    const whRes = await this.warehouseService.getWarehouse(entry.warehouseId || 1);
    const concepts = this.warehouseService.getConcepts('ENTRY');
    const concept = concepts.find((c) => c.id === entry.conceptId);

    const totalQty = (entry.productDetails || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
    const totalCost = (entry.productDetails || []).reduce(
      (acc, it) => acc + (it.quantity || 0) * (it.cost || it.price || 0),
      0,
    );

    const newEntry: WarehouseEntry = {
      ...entry,
      id,
      prefix: 'ENT',
      movementNumber: entryNumber,
      type: 'ENTRY',
      warehouseName: whRes?.data?.name || `Almacén #${entry.warehouseId}`,
      conceptName: concept?.name || 'Entrada de Almacén',
      createDate: new Date().toISOString(),
      statusId: 1, // Aplicado
      statusName: 'Aplicado',
      totalQuantity: totalQty,
      totalCost: totalCost,
    };

    // 1. Post to API if active
    try {
      await this.api.post<any, any>('/WarehouseEntry', newEntry);
    } catch {
      // offline fallback
    }

    // 2. Persist locally
    const currentList = this.getLocalEntries();
    currentList.unshift(newEntry);
    this.saveLocalEntries(currentList);

    // 3. Atomically increase stock in target warehouse for each line item
    for (const item of entry.productDetails) {
      await this.stockService.updateStock(
        entry.warehouseId || 1,
        item.productId,
        item.quantity,
        item.productName,
        item.barCode,
      );
    }

    return {
      success: true,
      data: newEntry,
      message: `Entrada ${entryNumber} registrada exitosamente. ${totalQty} unidades ingresadas a inventario.`,
    };
  }
}
