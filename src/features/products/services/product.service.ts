import { Injectable, inject } from '@angular/core';
import {
  ApiClientService,
  extractArray,
} from '../../cuadreEnv/services/apiClient';
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
  private readonly api = inject(ApiClientService);
  async getProduct(id: number): Promise<ApiResponse<ProductDto>> {
    const res = await this.api.get<any, any>(`/product/${id}`);
    return { success: true, data: res as ProductDto };
  }

  async searchProducts(
    description: string,
  ): Promise<ApiResponse<ProductDto[]>> {
    const res = await this.api.get<any, any>(`/product/search`, {
      params: { description },
    });
    return { success: true, data: extractArray<ProductDto>(res) };
  }

  async getPagedProducts(
    pageNumber: number,
    pageSize: number,
    description?: string,
    minCost?: number,
    maxCost?: number,
  ): Promise<ApiResponse<PagedProductsResponse>> {
    const params: Record<string, any> = {
      pageNumber,
      pageSize,
      PageNumber: pageNumber,
      PageSize: pageSize,
    };
    if (description) {
      params['description'] = description;
      params['Description'] = description;
    }
    if (minCost !== undefined && minCost !== null) {
      params['minCost'] = minCost;
      params['MinCost'] = minCost;
    }
    if (maxCost !== undefined && maxCost !== null) {
      params['maxCost'] = maxCost;
      params['MaxCost'] = maxCost;
    }

    try {
      const res = await this.api.get<any, any>(`/product/paged`, { params });
      if (res && typeof res === 'object') {
        const items = res.items || (Array.isArray(res) ? res : []);
        const total = res.totalItemCount ?? res.total ?? items.length;
        const page = res.pageNumber ?? res.page ?? pageNumber;
        const pSize = res.pageSize ?? pageSize;
        return {
          success: true,
          data: {
            items,
            total,
            page,
            pageSize: pSize,
          },
        };
      }
      return { success: true, data: res as PagedProductsResponse };
    } catch (e: any) {
      // Fallback: If backend /product/paged throws a 500 casting error (System.Double vs System.Decimal in BE),
      // query /product/search to seamlessly keep the UI operational.
      try {
        const searchRes = await this.api.get<any, any>(`/product/search`, {
          params: { description: description || '' },
        });
        const items = extractArray<ProductDto>(searchRes);
        const start = (pageNumber - 1) * pageSize;
        const pagedItems = items.slice(start, start + pageSize);
        return {
          success: true,
          data: {
            items: pagedItems,
            total: items.length,
            page: pageNumber,
            pageSize: pageSize,
          },
        };
      } catch {
        throw e;
      }
    }
  }

  async createProduct(product: ProductDto): Promise<ApiResponse<ProductDto>> {
    const res = await this.api.post<any, any>('/product', product);
    return { success: true, data: res as ProductDto };
  }

  async updateProduct(product: ProductDto): Promise<ApiResponse<any>> {
    const res = await this.api.put<any, any>('/product', product);
    return { success: true, data: res };
  }

  async deleteProduct(id: number): Promise<ApiResponse<any>> {
    const res = await this.api.delete<any, any>(`/product/${id}`);
    return { success: true, data: res };
  }
}
