import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManageRequestService } from '../../services/manage-request.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
import type { ManageRequest } from '../../../../app/models/manage-request';

@Component({
  selector: 'app-manage-request-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ListPaginationComponent],
  templateUrl: './manage-request-list.component.html',
  styleUrls: ['./manage-request-list.component.scss'],
})
export class ManageRequestListComponent implements OnInit {
  private requestService = inject(ManageRequestService);
  private notificationService = inject(NotificationService);

  requests = signal<ManageRequest[]>([]);
  isLoading = signal<boolean>(false);
  statusFilter = 0; // 0: Todos, 1: Pendiente, 2: Aprobado, 3: Rechazado
  searchTerm = '';

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  selectedRequest: ManageRequest | null = null;
  rejectionReason = '';
  approvalComment = '';
  isProcessing = false;

  readonly filteredRequests = computed(() => {
    let list = this.requests();
    const q = this.searchTerm.toLowerCase().trim();

    if (this.statusFilter !== 0) {
      list = list.filter((r) => r.statusId === this.statusFilter);
    }

    if (q) {
      list = list.filter(
        (r) =>
          r.requestNumber.toLowerCase().includes(q) ||
          r.typeName.toLowerCase().includes(q) ||
          r.creatorName.toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q),
      );
    }

    return list;
  });

  readonly pagedRequests = computed(() => {
    const list = this.filteredRequests();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.loadRequests();
  }

  async loadRequests() {
    this.isLoading.set(true);
    try {
      const res = await this.requestService.getRequests();
      if (res?.success && res.data) {
        this.requests.set(res.data);
      }
    } catch {
      // ignore
    } finally {
      this.isLoading.set(false);
    }
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  viewRequest(req: ManageRequest) {
    let parsed = null;
    try {
      parsed = JSON.parse(req.payloadJson || '{}');
    } catch {
      parsed = {};
    }
    this.selectedRequest = { ...req, payloadParsed: parsed };
    this.rejectionReason = '';
    this.approvalComment = '';
  }

  async approveSelected() {
    if (!this.selectedRequest) return;
    this.isProcessing = true;
    try {
      const res = await this.requestService.approveRequest(
        this.selectedRequest.id,
        this.approvalComment || 'Autorizado por el supervisor.',
      );
      if (res?.success) {
        this.notificationService.success(res.message || 'Solicitud aprobada y aplicada.');
        this.selectedRequest = null;
        this.loadRequests();
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isProcessing = false;
    }
  }

  async rejectSelected() {
    if (!this.selectedRequest) return;
    if (!this.rejectionReason.trim()) {
      this.notificationService.warning('Debe ingresar el motivo de rechazo.');
      return;
    }

    this.isProcessing = true;
    try {
      const res = await this.requestService.rejectRequest(
        this.selectedRequest.id,
        this.rejectionReason,
      );
      if (res?.success) {
        this.notificationService.info(res.message || 'Solicitud rechazada.');
        this.selectedRequest = null;
        this.loadRequests();
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isProcessing = false;
    }
  }
}
