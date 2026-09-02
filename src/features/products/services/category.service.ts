import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import type { ApiResponse } from '../../cuadreEnv/types/api';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly api = inject(ApiClientService);

  async getCategories(): Promise<ApiResponse<any[]>> {
    const res = await this.api.get<any, any>('/Category');
    return { success: true, data: extractArray<any>(res) };
  }

  async createCategory(category: any): Promise<ApiResponse<any>> {
    const res = await this.api.post<any, any>('/Category', category);
    return { success: true, data: res };
  }

  async getCategory(id: number): Promise<ApiResponse<any>> {
    const res = await this.api.get<any, any>(`/Category/${id}`);
    return { success: true, data: res };
  }

  async deleteCategory(id: number): Promise<void> {
    await this.api.delete(`/Category/${id}`);
  }
}
