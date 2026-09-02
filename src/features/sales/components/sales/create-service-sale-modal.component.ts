import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProductService } from '../../../products/services/product.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CashRegisterService } from '../../../cash-register/services/cash-register.service';
import { SaleService } from '../../services/sale.service';
import { ReceivableService } from '../../services/receivable.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { IconDirective } from '@coreui/icons-angular';
import { ProductTypeEnum, type ProductDto, type CustomerDto } from '../../../cuadreEnv/types/api';
import { type CompletedSaleDto } from './sale-completed-modal.component';

export interface ServiceCartItem {
  serviceId: number;
  serviceName: string;
  unitPrice: number;
  quantity: number;
}

@Component({
  selector: 'app-create-service-sale-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconDirective],
  templateUrl: './create-service-sale-modal.component.html',
  styleUrls: ['./create-service-sale-modal.component.scss'],
})
export class CreateServiceSaleModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);
  private productService = inject(ProductService);
  private customerService = inject(CustomerService);
  private registerService = inject(CashRegisterService);
  private saleService = inject(SaleService);
  private receivableService = inject(ReceivableService);
  private notificationService = inject(NotificationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();
  @Output() saleCompleted = new EventEmitter<CompletedSaleDto>();

  customers = signal<CustomerDto[]>([]);
  servicesList = signal<{ id: number; description: string; price: number }[]>([]);

  selectedCustomerId: number | null = null;
  paymentMode: 'CASH' | 'CREDIT' = 'CASH';
  dueDate: string = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Quick Service Creation
  isCreatingNewService = false;
  isSavingService = false;
  newServiceName = '';
  newServicePrice = 0;
  newServiceCost = 0;

  // Selection
  selectedServiceId: number | null = null;
  serviceQuantity = 1;

  // Cart
  cart: ServiceCartItem[] = [];
  serviceNotes = '';
  applyItbis = true;

  isSubmitting = false;

  get subtotal(): number {
    return this.cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  }

  get itbisAmount(): number {
    if (!this.applyItbis) return 0;
    return Math.round(this.subtotal * 0.18 * 100) / 100;
  }

  get totalAmount(): number {
    return this.subtotal + this.itbisAmount;
  }

  ngOnInit() {
    this.loadDependencies();
  }

  async loadDependencies() {
    try {
      const [cRes, pRes] = await Promise.all([
        this.customerService.getCustomers({
          pageNumber: 1,
          pageSize: 100,
          PageNumber: 1,
          PageSize: 100,
        } as any),
        this.productService.getPagedProducts(1, 100),
      ]);

      if (cRes.success && cRes.data) {
        this.customers.set(cRes.data);
      }

      if (pRes.success && pRes.data) {
        const items = pRes.data.items || [];
        // Map services (either ProductTypeEnum.Service or all items available for labor)
        const services = items.map((p) => ({
          id: p.id || 0,
          description: p.description || p.shortDescription || `Servicio #${p.id}`,
          price: p.cost > 0 ? p.cost : 500,
        }));
        this.servicesList.set(services);
      }
    } catch (e: any) {
      console.error('Error loading service modal data:', e);
    }
  }

  open() {
    this.visible = true;
    this.visibleChange.emit(true);
    this.loadDependencies();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.reset();
  }

  reset() {
    this.selectedCustomerId = null;
    this.paymentMode = 'CASH';
    this.cart = [];
    this.serviceNotes = '';
    this.isCreatingNewService = false;
    this.newServiceName = '';
    this.newServicePrice = 0;
    this.newServiceCost = 0;
    this.selectedServiceId = null;
    this.serviceQuantity = 1;
    this.applyItbis = true;
    this.isSubmitting = false;
  }

  onCustomerChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedCustomerId = val ? Number(val) : null;
  }

  setPaymentMode(mode: 'CASH' | 'CREDIT') {
    this.paymentMode = mode;
  }

  toggleNewServiceForm() {
    this.isCreatingNewService = !this.isCreatingNewService;
  }

  async saveAndAddService() {
    if (!this.newServiceName.trim() || this.newServicePrice <= 0) {
      this.notificationService.warning('Ingresa un nombre y precio válido para el servicio.');
      return;
    }

    this.isSavingService = true;
    try {
      const payload: ProductDto = {
        description: this.newServiceName.trim(),
        shortDescription: this.newServiceName.trim(),
        cost: Number(this.newServicePrice),
        stock: 0,
        invoiceWithoutStock: true,
        productTypeId: ProductTypeEnum.Service, // 2 = Service / Mano de Obra
      };

      const res = await this.productService.createProduct(payload);
      if (res.success && res.data) {
        const createdId = res.data.id || Date.now();
        const newServiceItem = {
          id: createdId,
          description: res.data.description || this.newServiceName.trim(),
          price: Number(this.newServicePrice),
        };

        this.servicesList.update((list) => [newServiceItem, ...list]);

        // Add directly to cart
        this.cart.push({
          serviceId: createdId,
          serviceName: newServiceItem.description,
          unitPrice: newServiceItem.price,
          quantity: 1,
        });

        this.notificationService.success(`Servicio "${newServiceItem.description}" creado y añadido.`);
        this.newServiceName = '';
        this.newServicePrice = 0;
        this.newServiceCost = 0;
        this.isCreatingNewService = false;
      } else {
        this.notificationService.error(res.message || 'Error al registrar el servicio.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isSavingService = false;
    }
  }

  addSelectedService() {
    if (!this.selectedServiceId || this.serviceQuantity <= 0) return;

    const found = this.servicesList().find((s) => s.id === this.selectedServiceId);
    if (!found) return;

    const existing = this.cart.find((c) => c.serviceId === this.selectedServiceId);
    if (existing) {
      existing.quantity += Number(this.serviceQuantity);
    } else {
      this.cart.push({
        serviceId: found.id,
        serviceName: found.description,
        unitPrice: found.price,
        quantity: Number(this.serviceQuantity),
      });
    }

    this.selectedServiceId = null;
    this.serviceQuantity = 1;
  }

  removeCartItem(index: number) {
    this.cart.splice(index, 1);
  }

  async processServiceSale() {
    if (this.cart.length === 0) {
      this.notificationService.warning('Agrega al menos un servicio a la venta.');
      return;
    }

    this.isSubmitting = true;

    try {
      let cashRegisterId: number | null = null;

      if (this.paymentMode === 'CASH') {
        const sessionRes = await this.registerService.getActiveSession();
        if (sessionRes?.success && sessionRes.data) {
          cashRegisterId = sessionRes.data.id;
        }
      }

      // 1. Create Sale in DB
      const salePayload = {
        customerId: this.selectedCustomerId,
        cashRegisterId: cashRegisterId,
        total: this.totalAmount,
        paidAmount: this.paymentMode === 'CASH' ? this.totalAmount : 0,
        dueDate: this.paymentMode === 'CREDIT' ? this.dueDate : null,
        details: this.cart.map((item) => ({
          productId: item.serviceId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const saleRes = await this.saleService.createSale(salePayload);
      const createdSaleId = saleRes?.data?.id || (saleRes as any)?.id;

      // 2. If Cash mode, record movement in cash register
      if (this.paymentMode === 'CASH' && cashRegisterId) {
        await this.registerService.addMovement({
          type: 'Entrada',
          category: 'Ventas',
          description: `Venta de Servicios #${createdSaleId || 'Servicio'} ${this.serviceNotes ? '(' + this.serviceNotes + ')' : ''}`,
          amount: this.totalAmount,
        });
      }

      // 3. If Credit mode, record Account Receivable
      if (this.paymentMode === 'CREDIT') {
        const customerName = this.customers().find((c) => c.id === this.selectedCustomerId)?.name || 'Cliente';
        await this.receivableService.createReceivable({
          customerId: this.selectedCustomerId,
          customerName: customerName,
          description: `Venta de Servicios #${createdSaleId || 'Servicio'} - ${this.serviceNotes || 'Mano de obra y servicios'}`,
          totalAmount: this.totalAmount,
          installmentAmount: this.totalAmount,
          totalInstallments: 1,
          startDate: this.dueDate,
          frequency: 'Mensual',
        });
      }

      this.notificationService.success(
        `Venta de servicio #${createdSaleId || ''} registrada exitosamente por RD$ ${this.totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}.`,
      );

      const cust = this.customers().find((c) => c.id === this.selectedCustomerId);
      const invoiceData: CompletedSaleDto = {
        id: createdSaleId,
        invoiceNumber: `VTA-SRV-${String(createdSaleId || Date.now()).slice(-6)}`,
        date: new Date().toISOString(),
        customerName: cust?.name || 'Consumidor final',
        customerRnc: cust?.identification || '000-0000000-0',
        cashRegisterName: cashRegisterId ? `Caja #${cashRegisterId}` : 'Venta Directa',
        cashierName: 'Admin',
        paymentMethod: this.paymentMode === 'CASH' ? 'Efectivo / Contado' : 'Crédito',
        subtotal: Math.round((this.totalAmount / 1.18) * 100) / 100,
        discount: 0,
        itbis: Math.round((this.totalAmount - (this.totalAmount / 1.18)) * 100) / 100,
        total: this.totalAmount,
        amountReceived: this.paymentMode === 'CASH' ? this.totalAmount : 0,
        change: 0,
        notes: this.serviceNotes || undefined,
        items: this.cart.map((it) => ({
          productId: it.serviceId,
          productCode: `SRV-${it.serviceId}`,
          productName: it.serviceName,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          total: it.quantity * it.unitPrice,
        })),
      };

      this.saleCompleted.emit(invoiceData);
      this.saved.emit();
      this.close();
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isSubmitting = false;
    }
  }
}
