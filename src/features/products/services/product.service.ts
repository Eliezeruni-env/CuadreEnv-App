import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ProductDto, ApiResponse, PagedResult } from '../../cuadreEnv/types/api';

export interface ProductFilters {
  description?: string;
  minCost?: number;
  maxCost?: number;
}

export interface PagedProductsResponse extends PagedResult<ProductDto> {
  total?: number;
  page?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    (environment.apiUrl || 'http://localhost:8080').replace(/\/v1\/?$/, '').replace(/\/$/, '') + '/v1';

  /**
   * Observable reactivo para el listado paginado de productos:
   * GET /v1/product/paged?pageNumber=1&pageSize=10
   * El backend limita pageSize a un máximo de 100.
   */
  getPagedProducts$(
    pageNumber = 1,
    pageSize = 10,
    filters?: ProductFilters
  ): Observable<ApiResponse<PagedProductsResponse>> {
    // Validar y acotar según reglas: no menor a 1, no mayor a 100
    const validPage = Math.max(1, pageNumber || 1);
    const validSize = Math.min(100, Math.max(1, pageSize || 10));

    let params = new HttpParams()
      .set('pageNumber', validPage.toString())
      .set('pageSize', validSize.toString());

    if (filters?.description && filters.description.trim()) {
      params = params.set('description', filters.description.trim());
    }
    if (filters?.minCost !== undefined && filters?.minCost !== null) {
      params = params.set('minCost', filters.minCost.toString());
    }
    if (filters?.maxCost !== undefined && filters?.maxCost !== null) {
      params = params.set('maxCost', filters.maxCost.toString());
    }

    const url = `${this.baseUrl}/product/paged`;

    return this.http.get<any>(url, { params }).pipe(
      map((res: any) => {
        const resData = res?.data ?? res?.Data ?? res?.value ?? res?.Value;
        let items: ProductDto[] = [];
        let total = 0;

        if (Array.isArray(res)) {
          items = res;
          total = res.length;
        } else if (Array.isArray(resData)) {
          items = resData;
          total = res?.totalItemCount ?? res?.TotalItemCount ?? res?.total ?? res?.Total ?? items.length;
        } else if (resData && typeof resData === 'object') {
          const rawItems =
            resData.items ??
            resData.Items ??
            resData.records ??
            resData.Records ??
            resData.data ??
            resData.Data;
          if (Array.isArray(rawItems)) {
            items = rawItems;
          }
          total =
            resData.totalItemCount ??
            resData.TotalItemCount ??
            resData.total ??
            resData.Total ??
            res?.totalItemCount ??
            res?.TotalItemCount ??
            items.length;
        } else if (res && typeof res === 'object') {
          const rawItems = res.items ?? res.Items ?? res.records ?? res.Records;
          if (Array.isArray(rawItems)) {
            items = rawItems;
          }
          total = res.totalItemCount ?? res.TotalItemCount ?? res.total ?? res.Total ?? items.length;
        }

        const pageCount = Math.max(1, Math.ceil(total / validSize));

        return {
          success: res?.success !== false && res?.Success !== false,
          data: {
            items,
            pageSize: validSize,
            pageCount,
            totalItemCount: total,
            total,
            page: validPage,
          },
          message: res?.message ?? res?.Message ?? null,
          errors: res?.errors ?? res?.Errors ?? [],
        };
      })
    );
  }

  /**
   * Versión Promise para compatibilidad directa en componentes existentes:
   * GET /v1/product/paged
   */
  async getPagedProducts(
    pageNumber = 1,
    pageSize = 10,
    description?: string,
    minCost?: number,
    maxCost?: number,
  ): Promise<ApiResponse<PagedProductsResponse>> {
    const validSize = Math.min(100, Math.max(1, pageSize || 10));
    try {
      return await firstValueFrom(
        this.getPagedProducts$(pageNumber, validSize, {
          description,
          minCost,
          maxCost,
        })
      );
    } catch {
      // Fallback a /v1/product sin /paged si el endpoint de paginación tiene otra ruta
      try {
        let params = new HttpParams()
          .set('pageNumber', pageNumber.toString())
          .set('pageSize', validSize.toString());
        if (description?.trim()) params = params.set('description', description.trim());
        const res: any = await firstValueFrom(this.http.get<any>(`${this.baseUrl}/product`, { params }));
        const rawList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.data?.items || []));
        return {
          success: true,
          data: {
            items: rawList,
            pageSize: validSize,
            pageCount: 1,
            totalItemCount: rawList.length,
            total: rawList.length,
            page: pageNumber,
          },
        };
      } catch {
        return {
          success: false,
          data: {
            items: [],
            pageSize: validSize,
            pageCount: 1,
            totalItemCount: 0,
            total: 0,
            page: pageNumber,
          },
        };
      }
    }
  }

  /**
   * Obtener detalle de un producto por ID:
   * GET /v1/product/{id}
   */
  async getProduct(id: number): Promise<ApiResponse<ProductDto>> {
    try {
      const url = `${this.baseUrl}/product/${id}`;
      const res: any = await firstValueFrom(this.http.get<any>(url));
      return { success: true, data: res?.data ?? res?.Data ?? res };
    } catch {
      const url2 = `${this.baseUrl}/Product/${id}`;
      const res2: any = await firstValueFrom(this.http.get<any>(url2));
      return { success: true, data: res2?.data ?? res2?.Data ?? res2 };
    }
  }

  /**
   * Búsqueda rápida por descripción:
   * GET /v1/product/search?description=arroz
   */
  async searchProducts(description: string): Promise<ApiResponse<ProductDto[]>> {
    const term = (description || '').trim();
    if (term) {
      try {
        const url = `${this.baseUrl}/product/search`;
        const params = new HttpParams().set('description', term);
        const res: any = await firstValueFrom(this.http.get<any>(url, { params }));
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.Data)
          ? res.Data
          : Array.isArray(res)
          ? res
          : (res?.data?.items || res?.Data?.Items || []);
        if (list.length > 0) {
          return { success: true, data: list };
        }
      } catch {
        // Fallback to getPagedProducts
      }
    }
    const paged = await this.getPagedProducts(1, 100, term || undefined);
    return { success: true, data: paged.data?.items || [] };
  }

  /**
   * Obtener productos de tipo servicio:
   * GET /v1/product/services
   */
  async getServices(): Promise<ApiResponse<ProductDto[]>> {
    try {
      const url = `${this.baseUrl}/product/services`;
      const res: any = await firstValueFrom(this.http.get<any>(url));
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      return { success: true, data: list };
    } catch {
      return { success: true, data: [] };
    }
  }

  /**
   * Crear nuevo producto:
   * POST /v1/product
   */
  async createProduct(product: ProductDto): Promise<ApiResponse<ProductDto>> {
    const url = `${this.baseUrl}/product`;
    return firstValueFrom(this.http.post<ApiResponse<ProductDto>>(url, product));
  }

  /**
   * Actualizar producto existente:
   * PUT /v1/product
   */
  async updateProduct(product: ProductDto): Promise<ApiResponse<any>> {
    const url = `${this.baseUrl}/product`;
    return firstValueFrom(this.http.put<ApiResponse<any>>(url, product));
  }

  /**
   * Eliminar producto:
   * DELETE /v1/product/{id}
   */
  async deleteProduct(id: number): Promise<ApiResponse<any>> {
    const url = `${this.baseUrl}/product/${id}`;
    return firstValueFrom(this.http.delete<ApiResponse<any>>(url));
  }
}
