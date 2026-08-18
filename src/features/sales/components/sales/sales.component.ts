import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaleService } from '../../services/sale.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { SaleResponseDto, CustomerDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { CreateSaleModalComponent } from './create-sale-modal.component';
import { SaleDetailModalComponent } from './sale-detail-modal.component';
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
    FilterPanelComponent,
    ListPaginationComponent,
  ],
})
export class SalesComponent implements OnInit {
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

  get filterConfig(): FilterConfig[] {
    return [
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
    ];
  }

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

      const cRes = await this.customerService.getCustomers();
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

  private getFilteredSalesBase(): SaleResponseDto[] {
    const activeFilters = this.filters();
    const search = String((activeFilters['search'] as string | undefined) || '')
      .trim()
      .toLowerCase();
    const status = String(
      (activeFilters['status'] as string | undefined) || '',
    ).trim();
    const amountFrom = Number(
      (activeFilters['amount'] as { from?: number | string | null } | undefined)
        ?.from ?? NaN,
    );
    const amountTo = Number(
      (activeFilters['amount'] as { to?: number | string | null } | undefined)
        ?.to ?? NaN,
    );

    return this.sales().filter((sale) => {
      const haystack = [
        sale.id.toString(),
        this.getCustomerName(sale.customerId),
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus =
        !status ||
        (status === 'processed' && !sale.isCancelled) ||
        (status === 'cancelled' && sale.isCancelled);
      const matchesAmountFrom =
        Number.isNaN(amountFrom) || sale.total >= amountFrom;
      const matchesAmountTo = Number.isNaN(amountTo) || sale.total <= amountTo;

      return (
        matchesSearch && matchesStatus && matchesAmountFrom && matchesAmountTo
      );
    });
  }

  getFilteredSalesCount(): number {
    return this.getFilteredSalesBase().length;
  }

  getFilteredSales(): SaleResponseDto[] {
    return this.getFilteredSalesBase().slice(
      (this.currentPage() - 1) * this.pageSize,
      this.currentPage() * this.pageSize,
    );
  }

  openCreateModal() {
    this.isCreateModalOpen = true;
    // reset form in child component
    setTimeout(() => {
      if (this.createSaleModal) this.createSaleModal.reset();
    });
  }

  viewSaleDetail(sale: SaleResponseDto) {
    this.selectedSale = sale;
    this.isDetailModalOpen = true;
  }

  getCustomerName(customerId?: number | null): string {
    if (!customerId) return 'General Public';
    const c = this.customers().find((item) => item.id === customerId);
    return c ? c.name : `Customer #${customerId}`;
  }
}
