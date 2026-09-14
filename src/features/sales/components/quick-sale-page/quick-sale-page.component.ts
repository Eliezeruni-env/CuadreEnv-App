import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CashRegisterService } from '../../../cash-register/services/cash-register.service';
import { ProductService } from '../../../products/services/product.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CategoryService } from '../../../products/services/category.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { ProductDto, CustomerDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import {
  SpinnerComponent,
} from '@coreui/angular';
import {
  SaleCompletedModalComponent,
  type CompletedSaleDto,
} from '../sales/sale-completed-modal.component';

export interface QuickSaleItem {
  productId: number;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

@Component({
  selector: 'app-quick-sale-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    SpinnerComponent,
    IconDirective,
    SaleCompletedModalComponent,
  ],
  templateUrl: './quick-sale-page.component.html',
  styleUrls: ['./quick-sale-page.component.scss'],
})
export class QuickSalePageComponent implements OnInit {
  readonly Math = Math;
  readonly translationService = inject(TranslationService);
  private cashRegisterService = inject(CashRegisterService);
  private productService = inject(ProductService);
  private customerService = inject(CustomerService);
  private categoryService = inject(CategoryService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  isLoadingProducts = signal<boolean>(false);
  products = signal<ProductDto[]>([]);
  customers = signal<CustomerDto[]>([]);

  selectedCustomerId: number | null = null;
  catalogSearchTerm = signal<string>('');
  selectedCategory = signal<number | null>(null);

  // Cart
  cartItems = signal<QuickSaleItem[]>([]);

  // Discounts & Payments (as Signals for reactive computed updates)
  discountType = signal<'percent' | 'fixed'>('percent');
  discountValue = signal<number>(0);

  selectedMethod = signal<string>('Efectivo');
  amountReceived = signal<number>(0);

  // Card details
  cardType = signal<'DEBIT' | 'CREDIT'>('DEBIT');
  cardLastFour = signal<string>('');
  cardAuthVoucher = signal<string>('');

  // Transfer details
  transferBank = signal<string>('');
  transferReference = signal<string>('');

  // Pagination for catalog
  catalogPage = signal<number>(1);
  catalogPageSize = 8;

  // Dynamic categories from database
  categories = signal<{ id: number | null; label: string }[]>([
    { id: null, label: 'Todos' },
  ]);

  // Session info & Cash Register Guard
  activeSessionName = signal<string>('Caja Principal');
  hasOpenSession = signal<boolean>(true);
  isOpenSessionModalVisible = signal<boolean>(false);

  // Completed sale receipt modal
  isSaleCompletedModalOpen = false;
  lastCompletedSale: CompletedSaleDto | null = null;

  readonly subtotal = computed(() => {
    return this.cartItems().reduce((acc, item) => acc + item.total, 0);
  });

  readonly discountAmount = computed(() => {
    const sub = this.subtotal();
    const val = Number(this.discountValue()) || 0;
    if (this.discountType() === 'percent') {
      return (sub * Math.max(0, Math.min(100, val))) / 100;
    }
    return Math.max(0, Math.min(sub, val));
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
    const received = Number(this.amountReceived()) || 0;
    const tot = this.total();
    return Math.max(0, Math.round((received - tot) * 100) / 100);
  });

  readonly filteredCatalogProducts = computed(() => {
    const term = this.catalogSearchTerm().toLowerCase().trim();
    const cat = this.selectedCategory();

    return this.products().filter((p) => {
      if (cat !== null) {
        const prodCatId = p.categoryId ?? (p as any).category?.id;
        if (prodCatId !== cat && p.productTypeId !== cat) {
          return false;
        }
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
      const [prodRes, custRes, catRes, sessionRes] = await Promise.all([
        this.productService.getPagedProducts(1, 200),
        this.customerService.getCustomers({ pageNumber: 1, pageSize: 200 } as any),
        this.categoryService.getCategories(),
        this.cashRegisterService.getActiveSession(),
      ]);

      if (prodRes?.success && prodRes.data?.items) {
        this.products.set(prodRes.data.items);
      }
      if (custRes?.success && custRes.data) {
        this.customers.set(custRes.data);
      }
      if (catRes?.success && Array.isArray(catRes.data) && catRes.data.length > 0) {
        const dynamicCats = catRes.data.map((c: any) => ({
          id: c.id,
          label: c.description || c.name || `Categoría #${c.id}`,
        }));
        this.categories.set([{ id: null, label: 'Todos' }, ...dynamicCats]);
      }      if (sessionRes?.success && sessionRes.data) {
        this.activeSessionName.set(`Caja #${sessionRes.data.id || 1} (Turno Abierto)`);
        this.hasOpenSession.set(true);
        this.isOpenSessionModalVisible.set(false);
      } else {
        this.activeSessionName.set('Sin Caja Abierta');
        this.hasOpenSession.set(false);
        this.isOpenSessionModalVisible.set(true);
      }
    } catch (e: any) {
      console.error('Error loading quick sale lookups:', e);
    } finally {
      this.isLoadingProducts.set(false);
    }
  }

  goToOpenCashRegister() {
    this.router.navigate(['/cash-register'], {
      queryParams: { requiresOpenSession: 'true', returnUrl: '/sales/quick' },
    });
  }

  goToSales() {
    this.router.navigate(['/sales']);
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
    const name = product.description || product.shortDescription || 'Producto';

    if (existingIdx >= 0) {
      const items = [...this.cartItems()];
      items[existingIdx].quantity += 1;
      items[existingIdx].total = items[existingIdx].quantity * items[existingIdx].unitPrice;
      this.cartItems.set(items);
    } else {
      this.cartItems.update((items) => [
        ...items,
        {
          productId: product.id ?? 0,
          productCode: code,
          productName: name,
          unitPrice: price,
          quantity: 1,
          total: price,
        },
      ]);
    }

    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  incrementQuantity(index: number) {
    const items = [...this.cartItems()];
    items[index].quantity += 1;
    items[index].total = items[index].quantity * items[index].unitPrice;
    this.cartItems.set(items);
    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
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
    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  updateItemQuantity(index: number, qty: number) {
    const val = Math.max(1, Number(qty) || 1);
    const items = [...this.cartItems()];
    items[index].quantity = val;
    items[index].total = items[index].unitPrice * val;
    this.cartItems.set(items);
    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  removeCartItem(index: number) {
    const items = [...this.cartItems()];
    items.splice(index, 1);
    this.cartItems.set(items);
    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  clearCart() {
    this.cartItems.set([]);
    this.amountReceived.set(0);
  }

  onDiscountChange() {
    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  setMethod(m: string) {
    this.selectedMethod.set(m);
    if (m !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  setAmountReceived(val: number) {
    this.amountReceived.set(Math.max(0, val));
  }

  resetForm() {
    this.selectedCustomerId = null;
    this.catalogSearchTerm.set('');
    this.selectedCategory.set(null);
    this.cartItems.set([]);
    this.discountValue.set(0);
    this.selectedMethod.set('Efectivo');
    this.amountReceived.set(0);
    this.catalogPage.set(1);
    this.cardLastFour.set('');
    this.cardAuthVoucher.set('');
    this.transferBank.set('');
    this.transferReference.set('');
  }

  async processQuickSale() {
    if (!this.hasOpenSession()) {
      this.notificationService.warning('Es obligatorio tener una caja abierta para procesar ventas.');
      this.isOpenSessionModalVisible.set(true);
      return;
    }

    if (this.cartItems().length === 0) {
      this.notificationService.warning('Agrega al menos un producto a la venta.');
      return;
    }

    let paymentDetailsNote = '';

    if (this.selectedMethod() === 'Efectivo') {
      if (this.amountReceived() < this.total()) {
        this.notificationService.warning(
          'El monto recibido no puede ser menor al total de la venta.',
        );
        return;
      }
    } else if (this.selectedMethod() === 'Tarjeta') {
      const four = this.cardLastFour().trim();
      const voucher = this.cardAuthVoucher().trim();
      if (!four || four.length < 4) {
        this.notificationService.warning('Debes ingresar los últimos 4 dígitos de la tarjeta.');
        return;
      }
      if (!voucher) {
        this.notificationService.warning('Debes ingresar el número de autorización / voucher.');
        return;
      }
      paymentDetailsNote = `Tarjeta ${this.cardType()} (****${four}) Auth: ${voucher}`;
    } else if (this.selectedMethod() === 'Transferencia') {
      const bank = this.transferBank().trim();
      const ref = this.transferReference().trim();
      if (!bank) {
        this.notificationService.warning('Debes especificar el banco de la transferencia.');
        return;
      }
      if (!ref) {
        this.notificationService.warning('Debes ingresar el número de confirmación / referencia de transferencia.');
        return;
      }
      paymentDetailsNote = `Transferencia ${bank} Ref: ${ref}`;
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
        amountReceived: this.selectedMethod() === 'Efectivo' ? this.amountReceived() : this.total(),
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
          cashRegisterName: this.activeSessionName(),
          cashierName: 'Admin',
          paymentMethod: paymentDetailsNote || this.selectedMethod(),
          subtotal: this.subtotal(),
          discount: this.discountAmount(),
          itbis: this.itbis(),
          total: this.total(),
          amountReceived: this.selectedMethod() === 'Efectivo' ? this.amountReceived() : this.total(),
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

        this.lastCompletedSale = completedData;
        this.isSaleCompletedModalOpen = true;
        this.resetForm();
      } else {
        this.notificationService.error(
          res.message || 'No se pudo procesar la venta rápida.',
        );
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  onSaleModalClosed() {
    this.isSaleCompletedModalOpen = false;
    this.lastCompletedSale = null;
    this.router.navigate(['/sales']);
  }
}
