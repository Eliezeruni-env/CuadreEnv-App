import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchaseService } from '../../services/purchase.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { PurchaseDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { PurchaseModalComponent } from './purchase-modal.component';
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
  selector: 'app-purchases',
  templateUrl: './purchases.component.html',
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
    PurchaseModalComponent,
    FilterPanelComponent,
    ListPaginationComponent,
  ],
})
export class PurchasesComponent implements OnInit {
  @ViewChild('purchaseModal') purchaseModal!: PurchaseModalComponent;

  readonly translationService = inject(TranslationService);

  purchases = signal<PurchaseDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  filters = signal<FilterValues>({});
  currentPage = signal<number>(1);
  pageSize = 10;
  totalItems = signal<number>(0);

  readonly filterConfig = computed<FilterConfig[]>(() => [
    {
      key: 'search',
      label: this.translationService.t('purchases.filterSearch'),
      type: 'text',
      placeholder: this.translationService.t('purchases.filterSearch'),
    },
    {
      key: 'total',
      label: this.translationService.t('purchases.filterTotal'),
      type: 'numberRange',
      placeholder: this.translationService.t('filterPanel.from'),
    },
  ]);

  isModalOpen = false;
  selectedPurchase: PurchaseDto | null = null;

  constructor(
    private purchaseService: PurchaseService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const purRes = await this.purchaseService.getPurchases();
      if (purRes.success && purRes.data) {
        this.purchases.set(purRes.data);
        this.totalItems.set(this.getFilteredPurchasesCount());
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message || e?.message || 'Error loading purchases.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  onFiltersChange(values: FilterValues) {
    this.filters.set(values);
    this.currentPage.set(1);
    this.totalItems.set(this.getFilteredPurchasesCount());
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  readonly filteredPurchasesBase = computed(() => {
    const activeFilters = this.filters();
    const search = String((activeFilters['search'] as string | undefined) || '')
      .trim()
      .toLowerCase();
    const totalFrom = Number(
      (activeFilters['total'] as { from?: number | string | null } | undefined)
        ?.from ?? NaN,
    );
    const totalTo = Number(
      (activeFilters['total'] as { to?: number | string | null } | undefined)
        ?.to ?? NaN,
    );

    return this.purchases().filter((purchase) => {
      const haystack = [
        purchase.id?.toString() || '',
        purchase.supplierId ? `supplier #${purchase.supplierId}` : '',
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesTotalFrom =
        Number.isNaN(totalFrom) || (purchase.total || 0) >= totalFrom;
      const matchesTotalTo =
        Number.isNaN(totalTo) || (purchase.total || 0) <= totalTo;

      return matchesSearch && matchesTotalFrom && matchesTotalTo;
    });
  });

  readonly filteredPurchasesCount = computed(() => this.filteredPurchasesBase().length);

  readonly pagedPurchases = computed(() => {
    return this.filteredPurchasesBase().slice(
      (this.currentPage() - 1) * this.pageSize,
      this.currentPage() * this.pageSize,
    );
  });

  getFilteredPurchasesCount(): number {
    return this.filteredPurchasesCount();
  }

  getFilteredPurchases(): PurchaseDto[] {
    return this.pagedPurchases();
  }

  openCreateModal() {
    this.selectedPurchase = null;
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.purchaseModal) this.purchaseModal.openCreate();
    });
  }

  viewPurchaseDetail(purchase: PurchaseDto) {
    this.selectedPurchase = purchase;
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.purchaseModal) this.purchaseModal.openDetail(purchase);
    });
  }
}
