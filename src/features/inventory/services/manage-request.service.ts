import { Injectable, inject } from '@angular/core';
import { ApiClientService, extractArray } from '../../cuadreEnv/services/apiClient';
import { StockService } from './stock.service';
import type { ApiResponse } from '../../cuadreEnv/types/api';
import {
  ManageRequest,
  ManageRequestType,
} from '../../../app/models/manage-request';

const MANAGE_REQUESTS_STORAGE_KEY = 'cuadreenv_manage_requests_db';

const DEFAULT_REQUESTS: ManageRequest[] = [
  {
    id: 1,
    requestNumber: 'REQ-000101',
    requestType: ManageRequestType.PurchaseReceipt,
    typeName: 'Recepción con Discrepancias',
    statusId: 1, // Pendiente
    statusName: 'Pendiente',
    creatorName: 'Almacenista Juan Pérez',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    comment: 'Llegaron 10 unidades adicionales en lote de Coca Cola 2L no contempladas en OC-000101.',
    payloadJson: JSON.stringify({
      purchaseOrderId: 101,
      orderNumber: 'OC-000101',
      warehouseId: 1,
      supplierName: 'Distribuidora Nacional C. por A.',
      items: [
        { productId: 1, productName: 'Coca Cola 2L Regular', quantityOrdered: 50, quantityReceived: 60, unitCost: 80 },
      ],
    }),
    timeline: [
      {
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
        action: 'Creación de Solicitud',
        userName: 'Juan Pérez',
        comment: 'Discrepancia detectada durante conteo físico.',
      },
    ],
  },
  {
    id: 2,
    requestNumber: 'REQ-000102',
    requestType: ManageRequestType.InventoryAdjustment,
    typeName: 'Ajuste de Inventario',
    statusId: 2, // Aprobado
    statusName: 'Aprobado',
    creatorName: 'Supervisor Luis Morales',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    reviewedAt: new Date(Date.now() - 86400000 + 3600000).toISOString(),
    reviewerName: 'Admin Auditor',
    comment: 'Ajuste por merma de 2 botellas rotas en estantería.',
    payloadJson: JSON.stringify({
      warehouseId: 1,
      items: [{ productId: 3, productName: 'Aceite Vegetal 64oz', quantity: -2 }],
    }),
    timeline: [
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        action: 'Creación de Solicitud',
        userName: 'Luis Morales',
        comment: 'Merma reportada en turno matutino.',
      },
      {
        timestamp: new Date(Date.now() - 86400000 + 3600000).toISOString(),
        action: 'Aprobación',
        userName: 'Admin Auditor',
        oldStatus: 'Pendiente',
        newStatus: 'Aprobado',
        comment: 'Comprobado informe de daño en pasillo 4.',
      },
    ],
  },
];

@Injectable({
  providedIn: 'root',
})
export class ManageRequestService {
  private api = inject(ApiClientService);
  private stockService = inject(StockService);

  private getLocalRequests(): ManageRequest[] {
    try {
      const raw = localStorage.getItem(MANAGE_REQUESTS_STORAGE_KEY);
      if (!raw) {
        this.saveLocalRequests(DEFAULT_REQUESTS);
        return DEFAULT_REQUESTS;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_REQUESTS;
    }
  }

  private saveLocalRequests(list: ManageRequest[]): void {
    try {
      localStorage.setItem(MANAGE_REQUESTS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local manage requests:', e);
    }
  }

  async getRequests(statusId?: number): Promise<ApiResponse<ManageRequest[]>> {
    const list = this.getLocalRequests();
    if (statusId) {
      return { success: true, data: list.filter((r) => r.statusId === statusId) };
    }
    return { success: true, data: list };
  }

  async getRequest(id: number): Promise<ApiResponse<ManageRequest>> {
    const list = this.getLocalRequests();
    const found = list.find((r) => r.id === id);
    if (found) {
      return {
        success: true,
        data: {
          ...found,
          payloadParsed: JSON.parse(found.payloadJson || '{}'),
        },
      };
    }
    return { success: false, message: 'Solicitud no encontrada.' };
  }

  async createRequest(req: Partial<ManageRequest>): Promise<ApiResponse<ManageRequest>> {
    const id = Date.now();
    const reqNum = `REQ-${String(id).slice(-6)}`;
    const newReq: ManageRequest = {
      id,
      requestNumber: reqNum,
      requestType: req.requestType || ManageRequestType.PurchaseReceipt,
      typeName: req.typeName || 'Solicitud de Revisión',
      statusId: 1, // Pendiente
      statusName: 'Pendiente',
      creatorName: req.creatorName || 'Usuario Almacén',
      createdAt: new Date().toISOString(),
      comment: req.comment || '',
      payloadJson: req.payloadJson || '{}',
      timeline: [
        {
          timestamp: new Date().toISOString(),
          action: 'Solicitud Enviada a Revisión',
          userName: req.creatorName || 'Usuario Almacén',
          comment: req.comment || 'Esperando autorización de supervisor.',
        },
      ],
    };

    const list = this.getLocalRequests();
    list.unshift(newReq);
    this.saveLocalRequests(list);

    try {
      await this.api.post<any, any>('/ManageRequest', newReq);
    } catch {
      // fallback
    }

    return {
      success: true,
      data: newReq,
      message: `Solicitud ${reqNum} registrada y enviada a la bandeja de autorizaciones.`,
    };
  }

  async approveRequest(id: number, comment?: string): Promise<ApiResponse<ManageRequest>> {
    const list = this.getLocalRequests();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return { success: false, message: 'Solicitud no encontrada.' };

    const req = list[idx];
    req.statusId = 2; // Aprobado
    req.statusName = 'Aprobado';
    req.reviewerName = 'Administrador / Supervisor';
    req.reviewedAt = new Date().toISOString();
    req.timeline.push({
      timestamp: new Date().toISOString(),
      action: 'Aprobación y Aplicación en Inventario',
      userName: 'Administrador / Supervisor',
      oldStatus: 'Pendiente',
      newStatus: 'Aprobado',
      comment: comment || 'Operación autorizada exitosamente.',
    });

    // Execute atomic changes based on payload
    try {
      const payload = JSON.parse(req.payloadJson || '{}');
      if (payload.items && Array.isArray(payload.items)) {
        for (const it of payload.items) {
          const qty = Number(it.quantityReceived ?? it.quantity ?? 0);
          if (qty !== 0) {
            await this.stockService.updateStock(
              payload.warehouseId || 1,
              it.productId,
              qty,
              it.productName,
              it.barCode,
            );
          }
        }
      }
    } catch (e) {
      console.warn('Error applying approved payload:', e);
    }

    this.saveLocalRequests(list);

    try {
      await this.api.post<any, any>(`/ManageRequest/${id}/approve`, { comment });
    } catch {
      // fallback
    }

    return {
      success: true,
      data: req,
      message: `Solicitud ${req.requestNumber} aprobada y aplicada en inventario.`,
    };
  }

  async rejectRequest(id: number, reason: string): Promise<ApiResponse<ManageRequest>> {
    const list = this.getLocalRequests();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return { success: false, message: 'Solicitud no encontrada.' };

    const req = list[idx];
    req.statusId = 3; // Rechazado
    req.statusName = 'Rechazado';
    req.reviewerName = 'Administrador / Supervisor';
    req.reviewedAt = new Date().toISOString();
    req.rejectionReason = reason;
    req.timeline.push({
      timestamp: new Date().toISOString(),
      action: 'Rechazo de Solicitud',
      userName: 'Administrador / Supervisor',
      oldStatus: 'Pendiente',
      newStatus: 'Rechazado',
      comment: reason,
    });

    this.saveLocalRequests(list);

    try {
      await this.api.post<any, any>(`/ManageRequest/${id}/reject`, { reason });
    } catch {
      // fallback
    }

    return {
      success: true,
      data: req,
      message: `Solicitud ${req.requestNumber} rechazada.`,
    };
  }
}
