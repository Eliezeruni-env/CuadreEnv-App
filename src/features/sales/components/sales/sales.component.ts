import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaleService } from '../../services/sale.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { SaleResponseDto, CustomerDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { CreateSaleModalComponent } from './create-sale-modal.component';
import { SaleDetailModalComponent } from './sale-detail-modal.component';
import { NewSaleChoiceModalComponent } from './new-sale-choice-modal.component';
import { QuickSaleModalComponent } from '../../../cash-register/components/cash-register/quick-sale-modal.component';
import { CreateReceivableModalComponent } from '../receivables/create-receivable-modal.component';
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
  selector: 'app-sales',
  templateUrl: './sales.component.html',
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
    CreateSaleModalComponent,
    SaleDetailModalComponent,
    NewSaleChoiceModalComponent,
    QuickSaleModalComponent,
    CreateReceivableModalComponent,
    FilterPanelComponent,
    ListPaginationComponent,
  ],
})
export class SalesComponent implements OnInit {
  @ViewChild('newSaleChoiceModal') newSaleChoiceModal!: NewSaleChoiceModalComponent;
  @ViewChild('quickSaleModal') quickSaleModal!: QuickSaleModalComponent;
  @ViewChild('createReceivableModal') createReceivableModal!: CreateReceivableModalComponent;
  @ViewChild('createSaleModal') createSaleModal!: CreateSaleModalComponent;

  readonly translationService = inject(TranslationService);

  sales = signal<SaleResponseDto[]>([]);
  customers = signal<CustomerDto[]>([]);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  filters = signal<FilterValues>({});
  currentPage = signal<number>(1);
  pageSize = 10;
  totalItems = signal<number>(0);

  readonly filterConfig = computed<FilterConfig[]>(() => [
    {
      key: 'search',
      label: this.translationService.t('sales.filterSearch'),
      type: 'text',
      placeholder: this.translationService.t('sales.filterSearch'),
    },
    {
      key: 'status',
      label: this.translationService.t('sales.filterStatus'),
      type: 'select',
      options: [
        { label: this.translationService.t('sales.filterAll'), value: '' },
        {
          label: this.translationService.t('sales.filterProcessed'),
          value: 'processed',
        },
        {
          label: this.translationService.t('sales.filterCancelled'),
          value: 'cancelled',
        },
      ],
    },
    {
      key: 'amount',
      label: this.translationService.t('sales.filterAmount'),
      type: 'numberRange',
      placeholder: this.translationService.t('filterPanel.from'),
    },
  ]);

  isChoiceModalOpen = false;
  isQuickSaleModalOpen = false;
  isCreateReceivableModalOpen = false;
  isCreateModalOpen = false;
  isDetailModalOpen = false;
  selectedSale: SaleResponseDto | null = null;

  constructor(
    private saleService: SaleService,
    private customerService: CustomerService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const sRes = await this.saleService.getSales();
      if (sRes.success && sRes.data) {
        this.sales.set(sRes.data);
        this.totalItems.set(this.getFilteredSalesCount());
      }

      const cRes = await this.customerService.getCustomers({
        pageNumber: 1,
        pageSize: 1000,
        PageNumber: 1,
        PageSize: 1000
      } as any);
      if (cRes.success && cRes.data) {
        this.customers.set(cRes.data);
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message || e?.message || 'Error loading sales.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  onFiltersChange(values: FilterValues) {
    this.filters.set(values);
    this.currentPage.set(1);
    this.totalItems.set(this.getFilteredSalesCount());
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  readonly filteredSalesBase = computed(() => {
    const activeFilters = this.filters();
    const search = String((activeFilters['search'] as string | undefined) || '')
      .trim()
      .toLowerCase();
    const status = String(
      (activeFilters['status'] as string | undefined) || '',
    );
    const amountMin =
      activeFilters['amount_min'] !== undefined &&
      activeFilters['amount_min'] !== ''
        ? Number(activeFilters['amount_min'])
        : null;
    const amountMax =
      activeFilters['amount_max'] !== undefined &&
      activeFilters['amount_max'] !== ''
        ? Number(activeFilters['amount_max'])
        : null;

    return this.sales().filter((sale) => {
      if (search) {
        const idMatch = String(sale.id).includes(search);
        const cust = this.customers().find((c) => c.id === sale.customerId);
        const nameMatch = cust?.name?.toLowerCase().includes(search);
        if (!idMatch && !nameMatch) return false;
      }

      if (status) {
        const isCancelled = (sale as any).isCancelled;
        if (status === 'cancelled' && !isCancelled) return false;
        if (status === 'processed' && isCancelled) return false;
      }

      if (amountMin !== null && sale.total < amountMin) {
        return false;
      }
      if (amountMax !== null && sale.total > amountMax) {
        return false;
      }

      return true;
    });
  });

  readonly pagedSales = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredSalesBase().slice(start, start + this.pageSize);
  });

  getFilteredSalesCount(): number {
    return this.filteredSalesBase().length;
  }

  getCustomerName(customerId: number): string {
    const customer = this.customers().find((c) => c.id === customerId);
    return customer ? customer.name : this.translationService.t('sales.table.unknownCustomer');
  }

  openCreateModal() {
    if (this.newSaleChoiceModal) {
      this.newSaleChoiceModal.open();
    } else {
      this.isCreateModalOpen = true;
    }
  }

  onSaleOptionChosen(option: 'quick' | 'credit') {
    if (option === 'quick') {
      if (this.quickSaleModal) {
        this.quickSaleModal.open();
      }
    } else {
      if (this.createReceivableModal) {
        this.createReceivableModal.open();
      }
    }
  }

  openDetailModal(sale: SaleResponseDto) {
    this.selectedSale = sale;
    this.isDetailModalOpen = true;
  }

  onSaleCreated() {
    this.loadData();
  }
}
