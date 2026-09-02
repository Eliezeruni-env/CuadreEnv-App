import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { CashRegisterService } from '../../services/cash-register.service';
import { ProductService } from '../../../products/services/product.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { ProductDto, CustomerDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  SpinnerComponent,
} from '@coreui/angular';

import { type CompletedSaleDto } from '../../../sales/components/sales/sale-completed-modal.component';

export interface QuickSaleItem {
  productId: number;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

@Component({
  selector: 'app-quick-sale-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonDirective,
    SpinnerComponent,
    IconDirective,
  ],
  templateUrl: './quick-sale-modal.component.html',
  styleUrls: ['./quick-sale-modal.component.scss'],
})
export class QuickSaleModalComponent implements OnInit {
  readonly Math = Math;
  readonly translationService = inject(TranslationService);
  private cashRegisterService = inject(CashRegisterService);
  private productService = inject(ProductService);
  private customerService = inject(CustomerService);
  private notificationService = inject(NotificationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() completed = new EventEmitter<void>();
  @Output() saleCompleted = new EventEmitter<CompletedSaleDto>();

  isLoading = signal<boolean>(false);
  isLoadingProducts = signal<boolean>(false);
  products = signal<ProductDto[]>([]);
  customers = signal<CustomerDto[]>([]);

  selectedCustomerId: number | null = null;
  catalogSearchTerm = '';
  selectedCategory = signal<number | null>(null);

  // Cart
  cartItems = signal<QuickSaleItem[]>([]);

  // Discounts & Payments
  discountType = signal<'percent' | 'fixed'>('percent');
  discountValue = 0;

  selectedMethod = signal<string>('Efectivo');
  amountReceived = 0;

  // Pagination for catalog
  catalogPage = signal<number>(1);
  catalogPageSize = 6;

  readonly categories = [
    { id: null, label: 'Todos' },
    { id: 1, label: 'General' },
    { id: 2, label: 'Alimentos' },
    { id: 3, label: 'Bebidas' },
    { id: 4, label: 'Papelería' },
    { id: 5, label: 'Servicios' },
  ];

  readonly subtotal = computed(() => {
    return this.cartItems().reduce((acc, item) => acc + item.total, 0);
  });

  readonly discountAmount = computed(() => {
    const sub = this.subtotal();
    if (this.discountType() === 'percent') {
      return (sub * Math.max(0, Math.min(100, this.discountValue))) / 100;
    }
    return Math.max(0, Math.min(sub, this.discountValue));
  });

  readonly itbis = computed(() => {
    const taxable = Math.max(0, this.subtotal() - this.discountAmount());
    return Math.round(taxable * 0.18 * 100) / 100;
  });

  readonly total = computed(() => {
    return Math.max(0, this.subtotal() - this.discountAmount() + this.itbis());
  });

  readonly change = computed(() => {
    if (this.selectedMethod() !== 'Efectivo') return 0;
    return Math.max(0, this.amountReceived - this.total());
  });

  readonly filteredCatalogProducts = computed(() => {
    const term = this.catalogSearchTerm.toLowerCase().trim();
    const cat = this.selectedCategory();

    return this.products().filter((p) => {
      if (cat !== null && p.categoryId !== cat && p.productTypeId !== cat) {
        return false;
      }
      if (term) {
        const desc = (p.description || '').toLowerCase();
        const code = (p.barcode || p.reference || '').toLowerCase();
        return desc.includes(term) || code.includes(term);
      }
      return true;
    });
  });

  readonly pagedCatalogProducts = computed(() => {
    const start = (this.catalogPage() - 1) * this.catalogPageSize;
    return this.filteredCatalogProducts().slice(start, start + this.catalogPageSize);
  });

  readonly totalCatalogPages = computed(() => {
    return Math.ceil(this.filteredCatalogProducts().length / this.catalogPageSize) || 1;
  });

  ngOnInit() {
    this.loadInitialLookups();
  }

  async loadInitialLookups() {
    this.isLoadingProducts.set(true);
    try {
      const [prodRes, custRes] = await Promise.all([
        this.productService.getPagedProducts(1, 100),
        this.customerService.getCustomers({ pageNumber: 1, pageSize: 100 } as any),
      ]);

      if (prodRes?.success && prodRes.data?.items) {
        this.products.set(prodRes.data.items);
      }
      if (custRes?.success && custRes.data) {
        this.customers.set(custRes.data);
      }
    } catch (e: any) {
      console.error('Error loading quick sale lookups:', e);
    } finally {
      this.isLoadingProducts.set(false);
    }
  }

  open() {
    this.visible = true;
    this.visibleChange.emit(true);
    this.resetForm();
    this.loadInitialLookups();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  resetForm() {
    this.selectedCustomerId = null;
    this.catalogSearchTerm = '';
    this.selectedCategory.set(null);
    this.cartItems.set([]);
    this.discountValue = 0;
    this.selectedMethod.set('Efectivo');
    this.amountReceived = 0;
    this.catalogPage.set(1);
  }

  setCategory(catId: number | null) {
    this.selectedCategory.set(catId);
    this.catalogPage.set(1);
  }

  prevCatalogPage() {
    if (this.catalogPage() > 1) {
      this.catalogPage.update((p) => p - 1);
    }
  }

  nextCatalogPage() {
    if (this.catalogPage() < this.totalCatalogPages()) {
      this.catalogPage.update((p) => p + 1);
    }
  }

  addProductToCart(product: ProductDto) {
    const existingIdx = this.cartItems().findIndex(
      (item) => item.productId === product.id,
    );
    const price = product.cost ? Number(product.cost) : 100;
    const code = product.barcode || product.reference || `PROD-${String(product.id || 1).padStart(4, '0')}`;

    if (existingIdx > -1) {
      const items = [...this.cartItems()];
      items[existingIdx].quantity += 1;
      items[existingIdx].total = items[existingIdx].quantity * items[existingIdx].unitPrice;
      this.cartItems.set(items);
    } else {
      this.cartItems.update((prev) => [
        ...prev,
        {
          productId: product.id || Date.now(),
          productCode: code,
          productName: product.description || 'Producto',
          unitPrice: price,
          quantity: 1,
          total: price,
        },
      ]);
    }

    this.amountReceived = this.total();
  }

  incrementQuantity(index: number) {
    const items = [...this.cartItems()];
    items[index].quantity += 1;
    items[index].total = items[index].quantity * items[index].unitPrice;
    this.cartItems.set(items);
    this.amountReceived = this.total();
  }

  decrementQuantity(index: number) {
    const items = [...this.cartItems()];
    if (items[index].quantity > 1) {
      items[index].quantity -= 1;
      items[index].total = items[index].quantity * items[index].unitPrice;
      this.cartItems.set(items);
    } else {
      this.removeCartItem(index);
    }
    this.amountReceived = this.total();
  }

  updateItemQuantity(index: number, qty: number) {
    const val = Math.max(1, Number(qty) || 1);
    const items = [...this.cartItems()];
    items[index].quantity = val;
    items[index].total = items[index].unitPrice * val;
    this.cartItems.set(items);
    this.amountReceived = this.total();
  }

  removeCartItem(index: number) {
    const items = [...this.cartItems()];
    items.splice(index, 1);
    this.cartItems.set(items);
    this.amountReceived = this.total();
  }

  clearCart() {
    this.cartItems.set([]);
    this.amountReceived = 0;
  }

  onDiscountChange() {
    this.amountReceived = this.total();
  }

  setMethod(m: string) {
    this.selectedMethod.set(m);
    if (m !== 'Efectivo') {
      this.amountReceived = this.total();
    }
  }

  setAmountReceived(val: number) {
    this.amountReceived = val;
  }

  async processQuickSale() {
    if (this.cartItems().length === 0) {
      this.notificationService.warning('Agrega al menos un producto a la venta.');
      return;
    }

    if (
      this.selectedMethod() === 'Efectivo' &&
      this.amountReceived < this.total()
    ) {
      this.notificationService.warning(
        'El monto recibido no puede ser menor al total de la venta.',
      );
      return;
    }

    this.isLoading.set(true);

    try {
      const res = await this.cashRegisterService.registerQuickSale({
        customerId: this.selectedCustomerId,
        customerName: this.selectedCustomerId ? 'Cliente Registrado' : 'Consumidor final',
        items: this.cartItems(),
        subtotal: this.subtotal(),
        discount: this.discountAmount(),
        itbis: this.itbis(),
        total: this.total(),
        paymentMethod: this.selectedMethod(),
        amountReceived: this.amountReceived,
        change: this.change(),
      });

      if (res.success) {
        const invNum = res.data?.invoiceNumber || `VTA-${String(res.data?.id || '000123')}`;
        const cust = this.customers().find((c) => c.id === this.selectedCustomerId);
        const custName = cust?.name || 'Consumidor final';
        const custRnc = cust?.identification || '000-0000000-0';

        const completedData: CompletedSaleDto = {
          id: res.data?.id || 123,
          invoiceNumber: invNum,
          date: new Date().toISOString(),
          customerName: custName,
          customerRnc: custRnc,
          cashRegisterName: 'Caja Principal',
          cashierName: 'Admin',
          paymentMethod: this.selectedMethod(),
          subtotal: this.subtotal(),
          discount: this.discountAmount(),
          itbis: this.itbis(),
          total: this.total(),
          amountReceived: this.amountReceived || this.total(),
          change: this.change(),
          items: this.cartItems().map((it) => ({
            productId: it.productId,
            productCode: it.productCode,
            productName: it.productName,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            total: it.total,
          })),
        };

        this.notificationService.success(
          `Venta rápida ${invNum} cobrada exitosamente por RD$ ${this.total().toLocaleString('es-DO', { minimumFractionDigits: 2 })}.`,
        );
        this.saleCompleted.emit(completedData);
        this.completed.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Error al procesar la venta.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
