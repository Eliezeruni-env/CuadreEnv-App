import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import type { ApiResponse } from '../../cuadreEnv/types/api';
import type { Warehouse, WarehouseConcept } from '../../../app/models/warehouse';

const WAREHOUSES_STORAGE_KEY = 'cuadreenv_warehouses_db';

const DEFAULT_WAREHOUSES: Warehouse[] = [];

const DEFAULT_CONCEPTS: WarehouseConcept[] = [
  { id: 1, name: 'Compra / Recepción de Mercancía', type: 'ENTRY', description: 'Ingreso directo por compras a proveedores' },
  { id: 2, name: 'Ajuste de Inventario (+)', type: 'ENTRY', description: 'Corrección de conteo sobrante' },
  { id: 3, name: 'Devolución de Cliente', type: 'ENTRY', description: 'Reingreso por nota de crédito' },
  { id: 4, name: 'Consumo Interno / Uso Operativo', type: 'OUTLET', description: 'Salida de insumos para la empresa' },
  { id: 5, name: 'Merma / Avería / Daño Físico', type: 'OUTLET', description: 'Producto deteriorado o roto' },
  { id: 6, name: 'Vencimiento / Caducidad', type: 'OUTLET', description: 'Producto vencido retirado' },
  { id: 7, name: 'Ajuste de Inventario (-)', type: 'OUTLET', description: 'Corrección de faltante físico' },
  { id: 8, name: 'Transferencia Inter-Sucursales', type: 'TRANSFER', description: 'Reubicación de existencias entre almacenes' },
];

@Injectable({
  providedIn: 'root',
})
export class WarehouseService {
  private api = inject(ApiClientService);

  private getLocalWarehouses(): Warehouse[] {
    try {
      const raw = localStorage.getItem(WAREHOUSES_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalWarehouses(list: Warehouse[]): void {
    try {
      localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local warehouses:', e);
    }
  }

  async getWarehouses(): Promise<ApiResponse<Warehouse[]>> {
    const localList = this.getLocalWarehouses();
    const localMap = new Map<number, Warehouse>(localList.map((w) => [w.id, w]));

    try {
      let res: any;
      try {
        res = await this.api.get<any, any>('/warehouse');
      } catch {
        res = await this.api.get<any, any>('/Warehouse');
      }

      const list = extractArray<any>(res);
      if (list && list.length > 0) {
        const normalized: Warehouse[] = list.map((item: any, idx: number) => {
          const id = item.id ?? item.warehouseId ?? (idx + 1);
          const local = localMap.get(id);

          return {
            id,
            name: local?.name || item.name || item.description || item.warehouseName || `Almacén #${id}`,
            code: local?.code || item.code || item.warehouseCode || `ALM-${String(id).padStart(2, '0')}`,
            address: local?.address || item.address || '',
            phone: local?.phone || item.phone || '',
            managerName: local?.managerName || item.managerName || '',
            isMain: local?.isMain ?? item.isMain ?? (idx === 0),
            isActive: local?.isActive ?? (item.isActive !== false),
            createdAt: local?.createdAt || item.createdAt || new Date().toISOString(),
          };
        });

        // Also add any purely local warehouses that don't exist in backend list
        localList.forEach((lw) => {
          if (!normalized.some((nw) => nw.id === lw.id)) {
            normalized.push(lw);
          }
        });

        this.saveLocalWarehouses(normalized);
        return { success: true, data: normalized };
      }
    } catch {
      // local fallback
    }
    return { success: true, data: localList };
  }

  async getWarehouse(id: number): Promise<ApiResponse<Warehouse>> {
    const list = this.getLocalWarehouses();
    const found = list.find((w) => w.id === id);
    if (found) return { success: true, data: found };
    return { success: false, message: 'Almacén no encontrado.' };
  }

  async createWarehouse(wh: Partial<Warehouse>): Promise<ApiResponse<Warehouse>> {
    const list = this.getLocalWarehouses();
    const newId = list.length > 0 ? Math.max(...list.map((w) => w.id)) + 1 : 1;
    const newWarehouse: Warehouse = {
      id: newId,
      name: wh.name || `Almacén #${newId}`,
      code: wh.code || `ALM-${String(newId).padStart(2, '0')}`,
      address: wh.address || '',
      phone: wh.phone || '',
      managerName: wh.managerName || '',
      isMain: wh.isMain || false,
      isActive: wh.isActive ?? true,
      createdAt: new Date().toISOString(),
    };

    if (newWarehouse.isMain) {
      list.forEach((w) => (w.isMain = false));
    }

    list.push(newWarehouse);
    this.saveLocalWarehouses(list);

    try {
      await this.api.post<any, any>('/warehouse', newWarehouse);
    } catch {
      try {
        await this.api.post<any, any>('/Warehouse', newWarehouse);
      } catch {
        // offline fallback
      }
    }

    return { success: true, data: newWarehouse, message: 'Almacén registrado exitosamente.' };
  }

  async updateWarehouse(wh: Warehouse): Promise<ApiResponse<Warehouse>> {
    const list = this.getLocalWarehouses();
    let idx = list.findIndex((w) => w.id === wh.id);
    if (idx === -1) {
      list.push(wh);
      idx = list.length - 1;
    }

    if (wh.isMain) {
      list.forEach((w) => {
        if (w.id !== wh.id) w.isMain = false;
      });
    }

    list[idx] = { ...list[idx], ...wh };
    this.saveLocalWarehouses(list);

    try {
      await this.api.put<any, any>(`/warehouse/${wh.id}`, wh);
    } catch {
      try {
        await this.api.put<any, any>(`/Warehouse/${wh.id}`, wh);
      } catch {
        try {
          await this.api.put<any, any>('/warehouse', wh);
        } catch {
          // offline fallback
        }
      }
    }

    return { success: true, data: list[idx], message: 'Almacén actualizado correctamente.' };
  }

  async deleteWarehouse(id: number): Promise<ApiResponse<boolean>> {
    const list = this.getLocalWarehouses().filter((w) => w.id !== id);
    this.saveLocalWarehouses(list);
    return { success: true, data: true, message: 'Almacén eliminado.' };
  }

  getConcepts(type?: 'ENTRY' | 'OUTLET' | 'TRANSFER'): WarehouseConcept[] {
    if (!type) return DEFAULT_CONCEPTS;
    return DEFAULT_CONCEPTS.filter((c) => c.type === type);
  }
}
