import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import type { PaymentDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import { PaymentModalComponent } from './payment-modal.component';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  RowComponent,
  TableDirective,
  AlertComponent,
  SpinnerComponent
} from '@coreui/angular';

@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    TableDirective,
    ButtonDirective,
    IconDirective,
    AlertComponent,
    SpinnerComponent,
    PaymentModalComponent
  ]
})
export class PaymentsComponent implements OnInit {
  @ViewChild('paymentModal') paymentModal!: PaymentModalComponent;

  payments = signal<PaymentDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  isModalOpen = false;

  constructor(
    private paymentService: PaymentService,
    public authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const payRes = await this.paymentService.getPayments();
      if (payRes.success && payRes.data) {
        this.payments.set(payRes.data);
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error loading payments.');
    } finally {
      this.isLoading.set(false);
    }
  }

  openCreateModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.paymentModal) this.paymentModal.openCreate();
    });
  }

  async deletePayment(id: number) {
    if (!confirm('Are you sure you want to delete this payment?')) return;

    this.isLoading.set(true);
    try {
      await this.paymentService.deletePayment(id);
      this.notificationService.success('Payment transaction deleted successfully.');
      this.loadData();
    } catch (e: any) {
      this.notificationService.error(e?.response?.data?.message || e?.message || 'Error deleting payment.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
