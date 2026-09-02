import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { ConfirmDialogService } from '../../../cuadreEnv/services/confirm-dialog.service';
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
  private confirmService = inject(ConfirmDialogService);

  payments = signal<PaymentDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  filters = signal<FilterValues>({});
  currentPage = signal<number>(1);
  pageSize = 10;
  totalItems = signal<number>(0);

  readonly filterConfig = computed<FilterConfig[]>(() => [
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
  ]);

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
      const mapped = this.notificationService.showApiError(e);
      this.errorMessage.set(mapped.message);
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

  readonly filteredPaymentsBase = computed(() => {
    const activeFilters = this.filters();
    const search = String((activeFilters['search'] as string | undefined) || '')
      .trim()
      .toLowerCase();
    const type = String(
      (activeFilters['type'] as string | undefined) || '',
    ).trim();

    return this.payments().filter((payment) => {
      const haystack = [
        payment.id?.toString() || '',
        payment.saleId ? `sale #${payment.saleId}` : '',
        payment.purchaseId ? `purchase #${payment.purchaseId}` : '',
        payment.reference || '',
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesType =
        !type ||
        (type === 'sale' && Boolean(payment.saleId)) ||
        (type === 'purchase' && Boolean(payment.purchaseId));

      return matchesSearch && matchesType;
    });
  });

  readonly filteredPaymentsCount = computed(() => this.filteredPaymentsBase().length);

  readonly pagedPayments = computed(() => {
    return this.filteredPaymentsBase().slice(
      (this.currentPage() - 1) * this.pageSize,
      this.currentPage() * this.pageSize,
    );
  });

  getFilteredPaymentsCount(): number {
    return this.filteredPaymentsCount();
  }

  getFilteredPayments(): PaymentDto[] {
    return this.pagedPayments();
  }

  openCreateModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.paymentModal) this.paymentModal.openCreate();
    });
  }

  async deletePayment(id: number) {
    const payment = this.payments().find((p) => p.id === id);
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar registro de pago?',
      message: '¿Estás seguro de que deseas eliminar esta transacción de pago? Los balances relacionados se recalcularán.',
      itemName: payment?.reference ? `Pago #${id} (Ref: ${payment.reference})` : `Pago #${id} - \$${payment?.amount || 0}`,
      itemType: 'Transacción de Pago',
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (!confirmed) return;

    this.isLoading.set(true);
    try {
      await this.paymentService.deletePayment(id);
      this.notificationService.success('Transacción de pago eliminada exitosamente.');
      this.loadData();
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}

