import { Injectable, inject } from '@angular/core';
import {
  ApiClientService,
  extractArray,
} from '../../cuadreEnv/services/apiClient';
import type {
  WarehouseDto,
  MovementDto,
  MovementRequestDto,
  TransferRequestDto,
  ProductDto,
  ApiResponse,
} from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly api = inject(ApiClientService);
  // Warehouses
  async getWarehouses(params?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<WarehouseDto[]>> {
    const res = await this.api.get<any, any>('/warehouse', { params });
    return { success: true, data: extractArray<WarehouseDto>(res) };
  }

  async createWarehouse(name: string): Promise<ApiResponse<WarehouseDto>> {
    const res = await this.api.post<any, any>('/warehouse', { name });
    return { success: true, data: res as WarehouseDto };
  }

  async addWarehouseStock(dto: any): Promise<ApiResponse<any>> {
    const res = await this.api.post<any, any>('/warehouse/stock/add', dto);
    return { success: true, data: res };
  }

  async removeWarehouseStock(dto: any): Promise<ApiResponse<any>> {
    const res = await this.api.post<any, any>('/warehouse/stock/remove', dto);
    return { success: true, data: res };
  }

  async transferWarehouseStock(dto: any): Promise<ApiResponse<any>> {
    const res = await this.api.post<any, any>('/warehouse/stock/transfer', dto);
    return { success: true, data: res };
  }

  // Inventory operations
  async addStock(dto: MovementRequestDto): Promise<ApiResponse<any>> {
    const res = await this.api.post<any, any>('/inventory/inbound', dto);
    return { success: true, data: res };
  }

  async removeStock(dto: MovementRequestDto): Promise<ApiResponse<any>> {
    const res = await this.api.post<any, any>('/inventory/outbound', dto);
    return { success: true, data: res };
  }

  async transferStock(dto: TransferRequestDto): Promise<ApiResponse<any>> {
    const res = await this.api.post<any, any>('/inventory/transfer', dto);
    return { success: true, data: res };
  }

  async getLowStock(): Promise<ApiResponse<ProductDto[]>> {
    const res = await this.api.get<any, any>('/inventory/low-stock');
    return { success: true, data: extractArray<ProductDto>(res) };
  }

  private readonly MOVEMENTS_STORAGE_KEY = 'cuadreEnv_inventory_movements';

  private getLocalMovements(): MovementDto[] {
    try {
      const raw = localStorage.getItem(this.MOVEMENTS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [
      { id: 1, productId: 1, fromWarehouseId: null, toWarehouseId: 1, quantity: 100, type: 'Inbound' },
      { id: 2, productId: 2, fromWarehouseId: 1, toWarehouseId: 2, quantity: 15, type: 'Transfer' },
      { id: 3, productId: 3, fromWarehouseId: 2, toWarehouseId: null, quantity: 5, type: 'Outbound' },
    ];
  }

  private saveLocalMovements(list: MovementDto[]) {
    try {
      localStorage.setItem(this.MOVEMENTS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  async getMovements(params?: {
    productId?: number;
    warehouseId?: number;
    from?: string;
    to?: string;
    type?: string;
  }): Promise<ApiResponse<MovementDto[]>> {
    try {
      const res = await this.api.get<any, any>('/inventory/movements', {
        params,
      });
      const data = extractArray<MovementDto>(res);
      if (data && data.length > 0) {
        this.saveLocalMovements(data);
        return { success: true, data };
      }
    } catch {
      // Try fallback endpoint
      try {
        const res2 = await this.api.get<any, any>('/v1/inventory/movements', { params });
        const data2 = extractArray<MovementDto>(res2);
        if (data2 && data2.length > 0) {
          this.saveLocalMovements(data2);
          return { success: true, data: data2 };
        }
      } catch {
        // Fallback to local
      }
    }

    let localData = this.getLocalMovements();
    if (params?.productId) {
      localData = localData.filter((m) => m.productId === params.productId);
    }
    if (params?.warehouseId) {
      localData = localData.filter(
        (m) => m.fromWarehouseId === params.warehouseId || m.toWarehouseId === params.warehouseId,
      );
    }
    if (params?.type) {
      localData = localData.filter((m) => m.type?.toLowerCase() === params.type?.toLowerCase());
    }

    return { success: true, data: localData };
  }

  async getAuditMovements(): Promise<ApiResponse<MovementDto[]>> {
    try {
      const res = await this.api.get<any, any>('/inventory/audit-movements');
      return { success: true, data: extractArray<MovementDto>(res) };
    } catch {
      try {
        const res2 = await this.api.get<any, any>('/v1/inventory/audit-movements');
        return { success: true, data: extractArray<MovementDto>(res2) };
      } catch {
        return { success: true, data: this.getLocalMovements() };
      }
    }
  }
}
