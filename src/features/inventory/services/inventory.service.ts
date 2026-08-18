import { Injectable } from '@angular/core';
import api, { extractArray } from '../../cuadreEnv/services/apiClient';
import type {
  WarehouseDto,
  CreateWarehouseDto,
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
  // Warehouses
  async getWarehouses(): Promise<ApiResponse<WarehouseDto[]>> {
    const res = await api.get<any>('/warehouse');
    return { success: true, data: extractArray<WarehouseDto>(res.data) };
  }

  async createWarehouse(name: string): Promise<ApiResponse<WarehouseDto>> {
    const res = await api.post<ApiResponse<WarehouseDto>>('/warehouse', { name });
    return res.data;
  }

  // Inventory operations
  async addStock(dto: MovementRequestDto): Promise<ApiResponse<any>> {
    const res = await api.post<ApiResponse<any>>('/inventory/inbound', dto);
    return res.data;
  }

  async removeStock(dto: MovementRequestDto): Promise<ApiResponse<any>> {
    const res = await api.post<ApiResponse<any>>('/inventory/outbound', dto);
    return res.data;
  }

  async transferStock(dto: TransferRequestDto): Promise<ApiResponse<any>> {
    const res = await api.post<ApiResponse<any>>('/inventory/transfer', dto);
    return res.data;
  }

  async getLowStock(): Promise<ApiResponse<ProductDto[]>> {
    const res = await api.get<any>('/inventory/low-stock');
    return { success: true, data: extractArray<ProductDto>(res.data) };
  }

  async getMovements(params?: {
    productId?: number;
    warehouseId?: number;
    from?: string;
    to?: string;
    type?: string;
  }): Promise<ApiResponse<MovementDto[]>> {
    const res = await api.get<any>('/inventory/movements', { params });
    return { success: true, data: extractArray<MovementDto>(res.data) };
  }

  async getAuditMovements(): Promise<ApiResponse<MovementDto[]>> {
    const res = await api.get<any>('/inventory/audit-movements');
    return { success: true, data: extractArray<MovementDto>(res.data) };
  }
}
