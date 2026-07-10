import { Injectable } from '@angular/core';
import api, { extractArray } from './apiClient';
import type { CashRegisterDto, CashMovementDto, ApiResponse } from '../models/api';

@Injectable({
  providedIn: 'root',
})
export class CashRegisterService {
  async getCashRegisters(): Promise<ApiResponse<CashRegisterDto[]>> {
    const res = await api.get<any>('/cashregister');
    return { success: true, data: extractArray<CashRegisterDto>(res.data) };
  }

  async getCashRegister(id: number): Promise<ApiResponse<CashRegisterDto>> {
    const res = await api.get<any>(`/cashregister/${id}`);
    if (res.data && typeof res.data.success === 'boolean') {
      return res.data;
    }
    return { success: true, data: res.data };
  }

  async openCashRegister(name: string): Promise<ApiResponse<CashRegisterDto>> {
    const res = await api.post<ApiResponse<CashRegisterDto>>('/cashregister/open', { name });
    return res.data;
  }

  async closeCashRegister(id: number, finalBalance: number): Promise<void> {
    await api.post(`/cashregister/${id}/close`, { finalBalance });
  }

  async getCashMovements(): Promise<ApiResponse<CashMovementDto[]>> {
    const res = await api.get<any>('/cashmovement');
    return { success: true, data: extractArray<CashMovementDto>(res.data) };
  }

  async createCashMovement(movement: CashMovementDto): Promise<void> {
    await api.post('/cashmovement', movement);
  }
}
