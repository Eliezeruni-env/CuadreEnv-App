import { Injectable, inject } from '@angular/core';
import { ApiClientService } from '../../cuadreEnv/services/apiClient';
import type {
  UserDto,
  UserPagedResponse,
  CreateUserPayload,
  UpdateUserPayload,
  ResetUserPasswordRequest,
} from '../../cuadreEnv/types/api';

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  q?: string;
  role?: string;
  active?: boolean;
}

export type UserPagedResult = UserPagedResponse & {
  success: boolean;
  data: UserDto[];
};

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly api: ApiClientService;

  constructor(api?: ApiClientService) {
    this.api = api ?? inject(ApiClientService, { optional: true })!;
  }

  async getUsers(params?: GetUsersParams): Promise<UserPagedResult> {
    const queryParams: Record<string, any> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (params?.q) queryParams['q'] = params.q;
    if (params?.role) queryParams['role'] = params.role;
    if (params?.active !== undefined && params?.active !== null) {
      queryParams['active'] = params.active;
    }
    // Note: Never send companyId / tenantId. The backend infers it securely from the JWT.

    try {
      const res = await this.api.get<any, any>('/users', { params: queryParams });

      const items: UserDto[] = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : [];

      const total: number = typeof res?.total === 'number' ? res.total : items.length;
      const page: number = typeof res?.page === 'number' ? res.page : (params?.page ?? 1);
      const pageSize: number = typeof res?.pageSize === 'number' ? res.pageSize : (params?.pageSize ?? 10);
      const totalPages: number =
        typeof res?.totalPages === 'number'
          ? res.totalPages
          : Math.ceil(total / (pageSize || 1));

      return {
        items,
        total,
        page,
        pageSize,
        totalPages,
        success: true,
        data: items,
      };
    } catch (error: any) {
      // If 404 (tenant has no users or endpoint returns 404), return safe empty list without crashing
      if (this.isNotFound(error)) {
        return {
          items: [],
          total: 0,
          page: params?.page ?? 1,
          pageSize: params?.pageSize ?? 10,
          totalPages: 0,
          success: true,
          data: [],
        };
      }
      throw error;
    }
  }

  async getUser(id: number): Promise<UserDto> {
    try {
      const res = await this.api.get<any, any>(`/users/${id}`);
      if (res && res.data) return res.data as UserDto;
      return res as UserDto;
    } catch (error: any) {
      if (this.isNotFound(error)) {
        throw new Error('El usuario no existe o no pertenece a su empresa.');
      }
      throw error;
    }
  }

  async createUser(payload: CreateUserPayload | UserDto): Promise<any> {
    // Note: companyId / tenantId is omitted. The backend binds it to the current tenant from JWT.
    const body: any = {
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      userName: payload.userName || payload.email,
      role: payload.role || 'Employee',
      temporaryPassword:
        (payload as any).temporaryPassword ||
        (payload as any).password ||
        null,
      sendByEmail: (payload as any).sendByEmail ?? true,
    };
    if ((payload as any).identification) body.identification = (payload as any).identification;
    if ((payload as any).phoneNumber) body.phoneNumber = (payload as any).phoneNumber;
    if ((payload as any).emergencyContact) body.emergencyContact = (payload as any).emergencyContact;

    return await this.api.post('/users', body);
  }

  async updateUser(
    id: number,
    payload: UpdateUserPayload | UserDto,
  ): Promise<void> {
    // Note: companyId / tenantId is omitted. Cross-tenant assignment is strictly forbidden.
    const body: any = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      userName: payload.userName,
      role: payload.role,
    };
    if ((payload as any).phoneNumber !== undefined) body.phoneNumber = (payload as any).phoneNumber;
    if ((payload as any).identification !== undefined) body.identification = (payload as any).identification;
    if ((payload as any).emergencyContact !== undefined) body.emergencyContact = (payload as any).emergencyContact;
    if ((payload as any).roles !== undefined) body.roles = (payload as any).roles;

    try {
      await this.api.put(`/users/${id}`, body);
    } catch (error: any) {
      if (this.isNotFound(error)) {
        throw new Error('No se puede actualizar: el usuario no existe o pertenece a otra empresa.');
      }
      throw error;
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      await this.api.delete(`/users/${id}`);
    } catch (error: any) {
      if (this.isNotFound(error)) {
        throw new Error('No se puede eliminar: el usuario no existe o pertenece a otra empresa.');
      }
      throw error;
    }
  }

  async toggleStatus(id: number, active: boolean): Promise<void> {
    try {
      await this.api.patch(`/users/${id}/status`, { active });
    } catch (error: any) {
      if (this.isNotFound(error)) {
        throw new Error('No se puede modificar el estado: el usuario no existe o pertenece a otra empresa.');
      }
      throw error;
    }
  }

  async deactivateUser(id: number): Promise<void> {
    await this.toggleStatus(id, false);
  }

  async reactivateUser(id: number): Promise<void> {
    await this.toggleStatus(id, true);
  }

  async resetPassword(
    id: number,
    req?: ResetUserPasswordRequest,
  ): Promise<any> {
    try {
      return await this.api.post(
        `/users/${id}/reset-password`,
        req || { sendByEmail: true },
      );
    } catch (error: any) {
      if (this.isNotFound(error)) {
        throw new Error('No se puede restablecer la contraseña: el usuario no existe o pertenece a otra empresa.');
      }
      throw error;
    }
  }

  async changeRole(id: number, role: string): Promise<void> {
    await this.updateUser(id, { role });
  }

  private isNotFound(error: any): boolean {
    return (
      error?.status === 404 ||
      error?.statusCode === 404 ||
      error?.mappedError?.statusCode === 404 ||
      error?.message?.includes?.('404')
    );
  }
}
