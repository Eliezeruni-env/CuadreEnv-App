import { Injectable } from '@angular/core';
import api from './apiClient';
import type { InvitationRequest, AcceptInvitationRequest, ApiResponse } from '../models/api';

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  async createInvitation(email: string, validDays?: number): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
    const res = await api.post<ApiResponse<{ token: string; expiresAt: string }>>('/invitations', {
      email,
      validDays,
    });
    return res.data;
  }

  async acceptInvitation(data: AcceptInvitationRequest): Promise<ApiResponse<any>> {
    const res = await api.post<ApiResponse<any>>('/invitations/accept', data);
    return res.data;
  }
}
