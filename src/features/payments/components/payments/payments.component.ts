import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { PaymentDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { PaymentModalComponent } from './payment-modal.component';
import {
  FilterPanelComponent,
  type FilterConfig,
  type FilterValues,
} from '../../../cuadreEnv/components/filter-panel/filter-panel.component';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ContainerComponent,
  AlertComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { TableComponent } from '../../../cuadreEnv/components/table/table.component';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';

@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    TableComponent,
    ButtonDirective,
    IconDirective,
    AlertComponent,
    SpinnerComponent,
    PaymentModalComponent,
    FilterPanelComponent,
    ListPaginationComponent,
  ],
})
export class PaymentsComponent implements OnInit {
  @ViewChild('paymentModal') paymentModal!: PaymentModalComponent;

  readonly translationService = inject(TranslationService);

  payments = signal<PaymentDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  filters = signal<FilterValues>({});
  currentPage = signal<number>(1);
  pageSize = 10;
  totalItems = signal<number>(0);

  get filterConfig(): FilterConfig[] {
    return [
      {
        key: 'search',
        label: this.translationService.t('payments.filterSearch'),
        type: 'text',
        placeholder: this.translationService.t('payments.filterSearch'),
      },
      {
        key: 'type',
        label: this.translationService.t('payments.filterType'),
        type: 'select',
        options: [
          { label: this.translationService.t('payments.filterAll'), value: '' },
          {
            label: this.translationService.t('payments.filterSale'),
            value: 'sale',
          },
          {
            label: this.translationService.t('payments.filterPurchase'),
            value: 'purchase',
          },
        ],
      },
    ];
  }

  isModalOpen = false;

  get columns() {
    return [
      {
        field: 'id',
        label: this.translationService.t('payments.table.paymentId'),
      },
      {
        field: 'date',
        label: this.translationService.t('payments.table.date'),
      },
      { field: 'ref', label: 'Sale/Purchase ID' },
      {
        field: 'method',
        label: this.translationService.t('payments.table.method'),
      },
      {
        field: 'reference',
        label: this.translationService.t('payments.table.reference'),
      },
      {
        field: 'amount',
        label: this.translationService.t('payments.table.amount'),
      },
      { field: 'actions', label: this.translationService.t('common.actions') },
    ];
  }

  constructor(
    private paymentService: PaymentService,
    public authService: AuthService,
    private notificationService: NotificationService,
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
        this.totalItems.set(this.getFilteredPaymentsCount());
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message || e?.message || 'Error loading payments.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  onFiltersChange(values: FilterValues) {
    this.filters.set(values);
    this.currentPage.set(1);
    this.totalItems.set(this.getFilteredPaymentsCount());
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  private getFilteredPaymentsBase(): PaymentDto[] {
    const activeFilters = this.filters();
    const search = String((activeFilters['search'] as string | undefined) || '')
      .trim()
      .toLowerCase();
    const type = String(
      (activeFilters['type'] as string | undefined) || '',
    ).trim();

    return this.payments().filter((payment) => {
      const haystack = [
        payment.method,
        payment.reference,
        payment.saleId?.toString(),
        payment.purchaseId?.toString(),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesType =
        !type ||
        (type === 'sale' && Boolean(payment.saleId)) ||
        (type === 'purchase' && Boolean(payment.purchaseId));

      return matchesSearch && matchesType;
    });
  }

  getFilteredPaymentsCount(): number {
    return this.getFilteredPaymentsBase().length;
  }

  getFilteredPayments(): PaymentDto[] {
    return this.getFilteredPaymentsBase().slice(
      (this.currentPage() - 1) * this.pageSize,
      this.currentPage() * this.pageSize,
    );
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
      this.notificationService.success(
        'Payment transaction deleted successfully.',
      );
      this.loadData();
    } catch (e: any) {
      this.notificationService.error(
        e?.response?.data?.message || e?.message || 'Error deleting payment.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
