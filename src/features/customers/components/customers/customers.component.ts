import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerService } from '../../services/customer.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { CustomerDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { CustomerModalComponent } from './customer-modal.component';
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
  selector: 'app-customers',
  templateUrl: './customers.component.html',
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
    CustomerModalComponent,
    FilterPanelComponent,
    ListPaginationComponent,
  ],
})
export class CustomersComponent implements OnInit {
  @ViewChild('customerModal') customerModal!: CustomerModalComponent;

  readonly translationService = inject(TranslationService);

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
        label: this.translationService.t('customers.filterSearch'),
        type: 'text',
        placeholder: this.translationService.t('customers.filterSearch'),
      },
      {
        key: 'status',
        label: this.translationService.t('customers.filterStatus'),
        type: 'select',
        options: [
          {
            label: this.translationService.t('customers.filterAll'),
            value: '',
          },
          {
            label: this.translationService.t('customers.filterActive'),
            value: 'active',
          },
          {
            label: this.translationService.t('customers.filterInactive'),
            value: 'inactive',
          },
        ],
      },
    ];
  }

  get columns() {
    return [
      {
        field: 'name',
        label: this.translationService.t('customers.table.name'),
      },
      {
        field: 'identification',
        label: this.translationService.t('customers.table.identification'),
      },
      {
        field: 'email',
        label: this.translationService.t('customers.table.email'),
      },
      {
        field: 'phone',
        label: this.translationService.t('customers.table.phone'),
      },
      { field: 'actions', label: this.translationService.t('common.actions') },
    ];
  }

  isModalOpen = false;

  constructor(
    private customerService: CustomerService,
    public authService: AuthService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.loadCustomers();
  }

  async loadCustomers() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const res = await this.customerService.getCustomers();
      if (res.success && res.data) {
        this.customers.set(res.data);
        this.totalItems.set(this.getFilteredCustomersCount());
      } else {
        this.errorMessage.set(res.message || 'Failed to load customers.');
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message || e?.message || 'Error loading customers.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  onFiltersChange(values: FilterValues) {
    this.filters.set(values);
    this.currentPage.set(1);
    this.totalItems.set(this.getFilteredCustomersCount());
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  private getFilteredCustomersBase(): CustomerDto[] {
    const activeFilters = this.filters();
    const search = String((activeFilters['search'] as string | undefined) || '')
      .trim()
      .toLowerCase();
    const status = String(
      (activeFilters['status'] as string | undefined) || '',
    ).trim();

    return this.customers().filter((customer) => {
      const haystack = [
        customer.name,
        customer.identification,
        customer.email,
        customer.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const isActive = customer.active !== false;
      const matchesStatus =
        !status ||
        (status === 'active' && isActive) ||
        (status === 'inactive' && !isActive);

      return matchesSearch && matchesStatus;
    });
  }

  getFilteredCustomersCount(): number {
    return this.getFilteredCustomersBase().length;
  }

  getFilteredCustomers(): CustomerDto[] {
    return this.getFilteredCustomersBase().slice(
      (this.currentPage() - 1) * this.pageSize,
      this.currentPage() * this.pageSize,
    );
  }

  openCreateModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.customerModal) this.customerModal.openCreate();
    });
  }

  openEditModal(customer: CustomerDto) {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.customerModal) this.customerModal.openEdit(customer);
    });
  }

  async deleteCustomer(id: number) {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    this.isLoading.set(true);
    try {
      await this.customerService.deleteCustomer(id);
      this.notificationService.success('Customer deleted successfully.');
      this.loadCustomers();
    } catch (e: any) {
      this.notificationService.error(
        e?.response?.data?.message || e?.message || 'Error deleting customer.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
