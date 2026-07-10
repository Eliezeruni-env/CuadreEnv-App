import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerService } from '../../services/customer.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import type { CustomerDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import { CustomerModalComponent } from './customer-modal.component';
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
  selector: 'app-customers',
  templateUrl: './customers.component.html',
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
    CustomerModalComponent
  ]
})
export class CustomersComponent implements OnInit {
  @ViewChild('customerModal') customerModal!: CustomerModalComponent;

  customers = signal<CustomerDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  isModalOpen = false;

  constructor(
    private customerService: CustomerService,
    public authService: AuthService,
    private notificationService: NotificationService
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
      } else {
        this.errorMessage.set(res.message || 'Failed to load customers.');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error loading customers.');
    } finally {
      this.isLoading.set(false);
    }
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
      this.notificationService.error(e?.response?.data?.message || e?.message || 'Error deleting customer.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
