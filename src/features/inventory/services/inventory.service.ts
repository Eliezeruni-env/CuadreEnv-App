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

  async getMovements(params?: {
    productId?: number;
    warehouseId?: number;
    from?: string;
    to?: string;
    type?: string;
  }): Promise<ApiResponse<MovementDto[]>> {
    const res = await this.api.get<any, any>('/inventory/movements', {
      params,
    });
    return { success: true, data: extractArray<MovementDto>(res) };
  }

  async getAuditMovements(): Promise<ApiResponse<MovementDto[]>> {
    const res = await this.api.get<any, any>('/inventory/audit-movements');
    return { success: true, data: extractArray<MovementDto>(res) };
  }
}
