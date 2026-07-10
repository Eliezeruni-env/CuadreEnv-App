import { Injectable } from '@angular/core';
import api, { extractArray } from './apiClient';
import type { UserDto, ApiResponse } from '../models/api';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  async getUsers(): Promise<ApiResponse<UserDto[]>> {
    const res = await api.get<any>('/user');
    return { success: true, data: extractArray<UserDto>(res.data) };
  }

  async getUser(id: number): Promise<ApiResponse<UserDto>> {
    const res = await api.get<any>(`/user/${id}`);
    if (res.data && typeof res.data.success === 'boolean') {
      return res.data;
    }
    return { success: true, data: res.data };
  }

  async createUser(user: UserDto): Promise<void> {
    await api.post('/user', user);
  }

  async updateUser(user: UserDto): Promise<void> {
    await api.put('/user', user);
  }

  async deleteUser(id: number): Promise<void> {
    await api.delete(`/user/${id}`);
  }

  async changeRole(id: number, role: string): Promise<void> {
    await api.put(`/user/${id}/role`, { role });
  }

  async deactivateUser(id: number): Promise<void> {
    await api.post(`/user/${id}/deactivate`);
  }

  async reactivateUser(id: number): Promise<void> {
    await api.post(`/user/${id}/reactivate`);
  }
}
