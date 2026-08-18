import { Injectable } from '@angular/core';
import api from '../../cuadreEnv/services/apiClient';
import type { ProductDto, ApiResponse } from '../../cuadreEnv/types/api';

export interface PagedProductsResponse {
  items: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  async getProduct(id: number): Promise<ApiResponse<ProductDto>> {
    const res = await api.get<ApiResponse<ProductDto>>(`/product/${id}`);
    return res.data;
  }

  async searchProducts(description: string): Promise<ApiResponse<ProductDto[]>> {
    const res = await api.get<ApiResponse<ProductDto[]>>(`/product/search`, {
      params: { description },
    });
    return res.data;
  }

  async getPagedProducts(page: number, pageSize: number, search?: string): Promise<ApiResponse<PagedProductsResponse>> {
    const res = await api.get<ApiResponse<PagedProductsResponse>>(`/Product/paged`, {
      params: {
        PageNumber: page,
        PageSize: pageSize,
        Description: search || null
      },
    });
    return res.data;
  }

  async createProduct(product: ProductDto): Promise<ApiResponse<ProductDto>> {
    const res = await api.post<ApiResponse<ProductDto>>('/product', product);
    return res.data;
  }

  async updateProduct(product: ProductDto): Promise<ApiResponse<any>> {
    const res = await api.put<ApiResponse<any>>('/product', product);
    return res.data;
  }

  async deleteProduct(id: number): Promise<ApiResponse<any>> {
    const res = await api.delete<ApiResponse<any>>(`/product/${id}`);
    return res.data;
  }
}
