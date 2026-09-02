import { Injectable, inject } from '@angular/core';
import {
  ApiClientService,
  extractArray,
} from '../../cuadreEnv/services/apiClient';
import type { UserDto, ApiResponse } from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly api = inject(ApiClientService);
  async getUsers(params?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<ApiResponse<UserDto[]>> {
    const res = await this.api.get<any, any>('/User', { params });
    return { success: true, data: extractArray<UserDto>(res) };
  }

  async getUser(id: number): Promise<ApiResponse<UserDto>> {
    const res = await this.api.get<any, any>(`/User/${id}`);
    return { success: true, data: res as UserDto };
  }

  async createUser(user: UserDto): Promise<void> {
    await this.api.post('/User', user);
  }

  async updateUser(user: UserDto): Promise<void> {
    await this.api.put('/User', user);
  }

  async deleteUser(id: number): Promise<void> {
    await this.api.delete(`/User/${id}`);
  }

  async changeRole(id: number, role: string): Promise<void> {
    await this.api.put(`/User/${id}/role`, { role });
  }

  async deactivateUser(id: number): Promise<void> {
    await this.api.post(`/User/${id}/deactivate`);
  }

  async reactivateUser(id: number): Promise<void> {
    await this.api.post(`/User/${id}/reactivate`);
  }
}
