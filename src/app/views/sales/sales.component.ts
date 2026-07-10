import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaleService } from '../../services/sale.service';
import { CustomerService } from '../../services/customer.service';
import { AuthService } from '../../services/auth.service';
import type { SaleResponseDto, CustomerDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import { CreateSaleModalComponent } from './create-sale-modal.component';
import { SaleDetailModalComponent } from './sale-detail-modal.component';
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
  selector: 'app-sales',
  templateUrl: './sales.component.html',
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
    CreateSaleModalComponent,
    SaleDetailModalComponent
  ]
})
export class SalesComponent implements OnInit {
  @ViewChild('createSaleModal') createSaleModal!: CreateSaleModalComponent;

  sales = signal<SaleResponseDto[]>([]);
  customers = signal<CustomerDto[]>([]);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  isCreateModalOpen = false;
  isDetailModalOpen = false;
  selectedSale: SaleResponseDto | null = null;

  constructor(
    private saleService: SaleService,
    private customerService: CustomerService,
    public authService: AuthService
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
      }

      const cRes = await this.customerService.getCustomers();
      if (cRes.success && cRes.data) {
        this.customers.set(cRes.data);
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error loading sales.');
    } finally {
      this.isLoading.set(false);
    }
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
    const c = this.customers().find(item => item.id === customerId);
    return c ? c.name : `Customer #${customerId}`;
  }
}
