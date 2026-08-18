import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { ProductDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { ProductModalComponent } from './product-modal.component';
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
  PaginationComponent,
  PageItemDirective,
  PageLinkDirective,
} from '@coreui/angular';

import { TableComponent } from '../../../cuadreEnv/components/table/table.component';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],
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
    PaginationComponent,
    PageItemDirective,
    PageLinkDirective,
    ProductModalComponent,
    FilterPanelComponent,
  ],
})
export class ProductsComponent implements OnInit {
  @ViewChild('productModal') productModal!: ProductModalComponent;

  readonly translationService = inject(TranslationService);

  products = signal<ProductDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Pagination
  currentPage = signal<number>(1);
  pageSize = 10;
  totalItems = signal<number>(0);

  filters = signal<FilterValues>({});
  get filterConfig(): FilterConfig[] {
    return [
      {
        key: 'search',
        label: this.translationService.t('products.filterSearch'),
        type: 'text',
        placeholder: this.translationService.t('products.filterSearch'),
      },
      {
        key: 'stock',
        label: this.translationService.t('products.filterStock'),
        type: 'numberRange',
        placeholder: this.translationService.t('filterPanel.from'),
      },
      {
        key: 'status',
        label: this.translationService.t('products.filterStatus'),
        type: 'select',
        options: [
          { label: this.translationService.t('products.filterAll'), value: '' },
          {
            label: this.translationService.t('products.filterInStock'),
            value: 'in-stock',
          },
          {
            label: this.translationService.t('products.filterLowStock'),
            value: 'low-stock',
          },
        ],
      },
    ];
  }

  isModalOpen = false;

  get columns() {
    return [
      {
        field: 'product',
        label: this.translationService.t('products.table.product'),
      },
      {
        field: 'reference',
        label: this.translationService.t('products.table.reference'),
      },
      {
        field: 'barcode',
        label: this.translationService.t('products.table.barcode'),
      },
      {
        field: 'cost',
        label: this.translationService.t('products.table.cost'),
      },
      {
        field: 'stock',
        label: this.translationService.t('products.table.stock'),
      },
      { field: 'actions', label: this.translationService.t('common.actions') },
    ];
  }

  constructor(
    private productService: ProductService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadProducts();
  }

  async loadProducts() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const res = await this.productService.getPagedProducts(
        this.currentPage(),
        this.pageSize,
      );
      if (res.success && res.data) {
        this.products.set(res.data.items || []);
        this.totalItems.set(res.data.total || 0);
      } else {
        this.errorMessage.set(
          res.message || 'Failed to load products catalogue.',
        );
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message || e?.message || 'Error loading products.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  onPageChange(page: number) {
    if (page < 1 || page * this.pageSize - this.pageSize >= this.totalItems())
      return;
    this.currentPage.set(page);
    this.loadProducts();
  }

  onFiltersChange(values: FilterValues) {
    this.filters.set(values);
  }

  getStockState(product: ProductDto): 'healthy' | 'low' | 'critical' {
    const stock = product.stock || 0;
    const minimum = product.minimumQuantity || 0;
    if (stock <= 0) return 'critical';
    if (stock <= minimum) return 'low';
    return 'healthy';
  }

  getFilteredProducts(): ProductDto[] {
    const activeFilters = this.filters();
    const search = String((activeFilters['search'] as string | undefined) || '')
      .trim()
      .toLowerCase();
    const stockFrom = Number(
      (activeFilters['stock'] as { from?: number | string | null } | undefined)
        ?.from ?? NaN,
    );
    const stockTo = Number(
      (activeFilters['stock'] as { to?: number | string | null } | undefined)
        ?.to ?? NaN,
    );
    const status = String(
      (activeFilters['status'] as string | undefined) || '',
    ).trim();

    return this.products().filter((product) => {
      const matchesSearch =
        !search ||
        [
          product.description,
          product.reference,
          product.barcode,
          product.shortDescription,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search);

      const matchesStockFrom =
        Number.isNaN(stockFrom) || (product.stock || 0) >= stockFrom;
      const matchesStockTo =
        Number.isNaN(stockTo) || (product.stock || 0) <= stockTo;

      const state = this.getStockState(product);
      const matchesStatus =
        !status ||
        (status === 'in-stock' && state === 'healthy') ||
        (status === 'low-stock' && state !== 'healthy');

      return (
        matchesSearch && matchesStockFrom && matchesStockTo && matchesStatus
      );
    });
  }

  openCreateModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.productModal) this.productModal.openCreate();
    });
  }

  openEditModal(product: ProductDto) {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.productModal) this.productModal.openEdit(product);
    });
  }
}
