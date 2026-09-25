import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  HostListener,
  ViewChild,
  ElementRef,
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
import {
  PosOfflineSyncService,
  generateIdempotencyKey,
} from '../../services/pos-offline-sync.service';
import {
  PosDraftStorageService,
  type PosHeldSale,
} from '../../services/pos-draft-storage.service';
import type { ProductDto, CustomerDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { SpinnerComponent } from '@coreui/angular';
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

export interface CriticalAlertState {
  title: string;
  message: string;
  canQueueOffline: boolean;
  rawPayload?: any;
}

const LAST_SALE_STORAGE_KEY = 'cuadre_last_completed_sale';

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
export class QuickSalePageComponent implements OnInit, OnDestroy {
  @ViewChild('catalogSearchInput') catalogSearchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('amountReceivedInput') amountReceivedInputRef?: ElementRef<HTMLInputElement>;

  readonly Math = Math;
  readonly translationService = inject(TranslationService);
  readonly offlineService = inject(PosOfflineSyncService);
  readonly draftStorageService = inject(PosDraftStorageService);

  private cashRegisterService = inject(CashRegisterService);
  private productService = inject(ProductService);
  private customerService = inject(CustomerService);
  private categoryService = inject(CategoryService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  isLoadingProducts = signal<boolean>(false);
  products = signal<ProductDto[]>([]);
  customers = signal<CustomerDto[]>([]);

  selectedCustomerId: number | null = null;
  catalogSearchTerm = signal<string>('');
  selectedCategory = signal<number | null>(null);

  // Cart
  cartItems = signal<QuickSaleItem[]>([]);

  // Discounts & Payments
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

  categories = signal<{ id: number | null; label: string }[]>([
    { id: null, label: 'Todos' },
  ]);

  // Session info & Cash Register Guard
  activeSessionName = signal<string>('Caja Principal');
  hasOpenSession = signal<boolean>(true);
  isOpenSessionModalVisible = signal<boolean>(false);

  // Completed sale receipt modal
  isSaleCompletedModalOpen = false;
  lastCompletedSale = signal<CompletedSaleDto | null>(null);

  // Held Carts (Ventas en espera) Modal
  isHeldSalesModalOpen = signal<boolean>(false);

  // Offline Conflict Resolution Modal
  isConflictsModalOpen = signal<boolean>(false);

  // Persistent Critical Alert Panel
  criticalAlert = signal<CriticalAlertState | null>(null);

  private sessionExpiredListener?: () => void;
  private beforeUnloadListener?: () => void;

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
    this.restoreLastCompletedSale();
    this.restoreActiveDraftIfAny();
    this.registerDraftLifecycleListeners();
  }

  ngOnDestroy() {
    this.saveActiveDraftBeforeExit();
    if (typeof window !== 'undefined') {
      if (this.sessionExpiredListener) {
        window.removeEventListener('cuadre:session-expired', this.sessionExpiredListener);
      }
      if (this.beforeUnloadListener) {
        window.removeEventListener('beforeunload', this.beforeUnloadListener);
      }
    }
  }

  // =========================================================================
  // Keyboard Shortcuts (WCAG & Ergonomic Fast POS)
  // =========================================================================
  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    // F2: Focus catalog search
    if (event.key === 'F2') {
      event.preventDefault();
      this.catalogSearchInputRef?.nativeElement?.focus();
      return;
    }

    // F4: Trigger / Focus Payment
    if (event.key === 'F4') {
      event.preventDefault();
      if (this.cartItems().length > 0) {
        if (this.selectedMethod() === 'Efectivo') {
          this.amountReceivedInputRef?.nativeElement?.focus();
        }
        void this.processQuickSale();
      } else {
        this.notificationService.warning('Agrega productos al carrito antes de cobrar (F4).');
      }
      return;
    }

    // F8: Hold Current Sale (Poner en espera)
    if (event.key === 'F8') {
      event.preventDefault();
      this.holdCurrentSale();
      return;
    }

    // F9: Open Held Sales (Recuperar venta en espera)
    if (event.key === 'F9') {
      event.preventDefault();
      this.openHeldSalesModal();
      return;
    }

    // Escape: Dismiss alert or close modals
    if (event.key === 'Escape') {
      if (this.criticalAlert()) {
        this.criticalAlert.set(null);
        return;
      }
      if (this.isHeldSalesModalOpen()) {
        this.isHeldSalesModalOpen.set(false);
        return;
      }
    }
  }

  // =========================================================================
  // Draft Lifecycle & Session Expiration Recovery
  // =========================================================================
  private registerDraftLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    this.sessionExpiredListener = () => {
      this.saveActiveDraftBeforeExit();
    };
    window.addEventListener('cuadre:session-expired', this.sessionExpiredListener);

    this.beforeUnloadListener = () => {
      this.saveActiveDraftBeforeExit();
    };
    window.addEventListener('beforeunload', this.beforeUnloadListener);
  }

  private saveActiveDraftBeforeExit(): void {
    if (this.cartItems().length === 0) return;
    this.draftStorageService.saveActiveDraft({
      customerId: this.selectedCustomerId,
      customerName: this.selectedCustomerId ? 'Cliente Registrado' : 'Consumidor final',
      items: this.cartItems(),
      discountType: this.discountType(),
      discountValue: this.discountValue(),
      selectedMethod: this.selectedMethod(),
      amountReceived: this.amountReceived(),
      cardLastFour: this.cardLastFour(),
      cardAuthVoucher: this.cardAuthVoucher(),
      transferBank: this.transferBank(),
      transferReference: this.transferReference(),
      timestamp: new Date().toISOString(),
    });
  }

  private restoreActiveDraftIfAny(): void {
    const draft = this.draftStorageService.getActiveDraft();
    if (!draft || !draft.items || draft.items.length === 0) return;

    this.cartItems.set(draft.items);
    this.selectedCustomerId = draft.customerId || null;
    this.discountType.set(draft.discountType || 'percent');
    this.discountValue.set(draft.discountValue || 0);
    this.selectedMethod.set(draft.selectedMethod || 'Efectivo');
    this.amountReceived.set(draft.amountReceived || 0);
    this.cardLastFour.set(draft.cardLastFour || '');
    this.cardAuthVoucher.set(draft.cardAuthVoucher || '');
    this.transferBank.set(draft.transferBank || '');
    this.transferReference.set(draft.transferReference || '');

    this.draftStorageService.clearActiveDraft();
    this.notificationService.info(
      'Se ha restaurado automáticamente la venta en curso previa a la expiración de sesión.',
    );
  }

  private restoreLastCompletedSale(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const raw = sessionStorage.getItem(LAST_SALE_STORAGE_KEY);
      if (raw) {
        this.lastCompletedSale.set(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }

  private persistLastCompletedSale(sale: CompletedSaleDto): void {
    this.lastCompletedSale.set(sale);
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      sessionStorage.setItem(LAST_SALE_STORAGE_KEY, JSON.stringify(sale));
    } catch {
      // ignore
    }
  }

  reprintLastSale(): void {
    const last = this.lastCompletedSale();
    if (!last) {
      this.notificationService.warning('No hay una venta reciente para reimprimir.');
      return;
    }
    this.isSaleCompletedModalOpen = true;
  }

  // =========================================================================
  // Lookups & Data Loading
  // =========================================================================
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
      }
      if (sessionRes?.success && sessionRes.data) {
        this.activeSessionName.set(`Caja #${sessionRes.data.id || 1} (${sessionRes.data.cashierName || 'Turno Abierto'})`);
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

  // =========================================================================
  // Cart Actions
  // =========================================================================
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
    this.draftStorageService.clearActiveDraft();
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
    this.criticalAlert.set(null);
    this.draftStorageService.clearActiveDraft();
  }

  // =========================================================================
  // Held Sales (Ventas en espera - F8 / F9)
  // =========================================================================
  holdCurrentSale(): void {
    if (this.cartItems().length === 0) {
      this.notificationService.warning('El carrito está vacío. Agregue productos antes de poner la venta en espera.');
      return;
    }

    const cust = this.customers().find((c) => c.id === this.selectedCustomerId);
    const custName = cust?.name || 'Consumidor final';

    const held = this.draftStorageService.holdSale(
      {
        customerId: this.selectedCustomerId,
        customerName: custName,
        items: this.cartItems(),
        discountType: this.discountType(),
        discountValue: this.discountValue(),
        selectedMethod: this.selectedMethod(),
        amountReceived: this.amountReceived(),
        timestamp: new Date().toISOString(),
      },
      `${custName} (${this.cartItems().length} arts. - RD$ ${this.total().toFixed(2)})`,
    );

    this.notificationService.success(`Venta puesta en espera (${held.label}).`);
    this.resetForm();
  }

  openHeldSalesModal(): void {
    this.draftStorageService.reloadHeldSales();
    this.isHeldSalesModalOpen.set(true);
  }

  closeHeldSalesModal(): void {
    this.isHeldSalesModalOpen.set(false);
  }

  resumeHeldSale(held: PosHeldSale): void {
    if (this.cartItems().length > 0) {
      this.draftStorageService.holdSale({
        customerId: this.selectedCustomerId,
        items: this.cartItems(),
        discountType: this.discountType(),
        discountValue: this.discountValue(),
        selectedMethod: this.selectedMethod(),
        amountReceived: this.amountReceived(),
        timestamp: new Date().toISOString(),
      });
    }

    this.cartItems.set(held.items);
    this.selectedCustomerId = held.customerId;
    this.discountType.set(held.discountType);
    this.discountValue.set(held.discountValue);
    this.selectedMethod.set(held.selectedMethod || 'Efectivo');
    this.amountReceived.set(held.amountReceived || 0);

    this.draftStorageService.resumeHeldSale(held.id);
    this.isHeldSalesModalOpen.set(false);
    this.notificationService.info(`Venta recuperada: ${held.label}`);
  }

  dismissHeldSale(id: string): void {
    this.draftStorageService.removeHeldSale(id);
  }

  // =========================================================================
  // Process Quick Sale (Idempotent & Double-Click Protected)
  // =========================================================================
  async processQuickSale() {
    // 1. Double-Click Synchronous Guard
    if (this.isSubmitting() || this.isLoading()) {
      return;
    }

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
        this.notificationService.warning('El monto recibido no puede ser menor al total de la venta.');
        this.amountReceivedInputRef?.nativeElement?.focus();
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
        this.notificationService.warning('Debes ingresar el número de confirmación / referencia.');
        return;
      }
      paymentDetailsNote = `Transferencia ${bank} Ref: ${ref}`;
    }

    // Set submit lock immediately
    this.isSubmitting.set(true);
    this.isLoading.set(true);
    this.criticalAlert.set(null);

    const idempotencyKey = generateIdempotencyKey();
    const cust = this.customers().find((c) => c.id === this.selectedCustomerId);
    const custName = cust?.name || 'Consumidor final';
    const custRnc = cust?.identification || '000-0000000-0';

    const payload = {
      customerId: this.selectedCustomerId,
      customerName: custName,
      items: this.cartItems(),
      subtotal: this.subtotal(),
      discount: this.discountAmount(),
      itbis: this.itbis(),
      total: this.total(),
      paymentMethod: paymentDetailsNote || this.selectedMethod(),
      amountReceived: this.selectedMethod() === 'Efectivo' ? this.amountReceived() : this.total(),
      change: this.change(),
      idempotencyKey,
    };

    // Check Offline state directly before dispatching
    if (!this.offlineService.isOnline()) {
      this.handleOfflineSaleExecution(payload);
      return;
    }

    try {
      const res = await this.cashRegisterService.registerQuickSale(payload);

      if (res.success) {
        const invNum = res.data?.invoiceNumber || `VTA-${String(res.data?.id || '000123')}`;

        const completedData: CompletedSaleDto = {
          id: res.data?.id || Date.now(),
          invoiceNumber: invNum,
          date: new Date().toISOString(),
          customerName: custName,
          customerRnc: custRnc,
          cashRegisterName: this.activeSessionName(),
          cashierName: 'Admin',
          paymentMethod: payload.paymentMethod,
          subtotal: this.subtotal(),
          discount: this.discountAmount(),
          itbis: this.itbis(),
          total: this.total(),
          amountReceived: payload.amountReceived,
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

        this.persistLastCompletedSale(completedData);
        this.isSaleCompletedModalOpen = true;
        this.resetForm();
      } else {
        this.handlePaymentFailure(
          'Error al procesar la venta',
          res.message || 'El servidor rechazó la transacción de cobro.',
          payload,
        );
      }
    } catch (e: any) {
      // Network drop or timeout during payment
      this.handlePaymentFailure(
        'Fallo de Red o Servidor en el Cobro',
        e?.message || 'Se perdió la conexión con el servidor mientras se registraba la venta.',
        payload,
      );
    } finally {
      this.isLoading.set(false);
      this.isSubmitting.set(false);
    }
  }

  private handleOfflineSaleExecution(payload: any): void {
    const offlineResult = this.offlineService.queueOfflineSale(payload);
    this.isLoading.set(false);
    this.isSubmitting.set(false);

    if (offlineResult.success && offlineResult.receipt) {
      this.persistLastCompletedSale(offlineResult.receipt);
      this.isSaleCompletedModalOpen = true;
      this.notificationService.warning(
        'Venta registrada en MODO OFFLINE (Guardada en gaveta local). Se sincronizará en cuanto regrese la conexión.',
      );
      this.resetForm();
    } else {
      this.criticalAlert.set({
        title: 'Bloqueo en Modo Offline',
        message:
          offlineResult.errorMessage ||
          'No se puede procesar el cobro electrónico sin conexión. Debe cobrar en efectivo o restaurar la red.',
        canQueueOffline: false,
      });
    }
  }

  private handlePaymentFailure(title: string, message: string, payload: any): void {
    const isCash = this.selectedMethod() === 'Efectivo';
    this.criticalAlert.set({
      title,
      message,
      canQueueOffline: isCash,
      rawPayload: payload,
    });
  }

  retryCriticalPayment(): void {
    this.criticalAlert.set(null);
    void this.processQuickSale();
  }

  forceQueueOfflineSale(): void {
    const alertData = this.criticalAlert();
    if (!alertData || !alertData.rawPayload) return;
    this.criticalAlert.set(null);
    this.handleOfflineSaleExecution(alertData.rawPayload);
  }

  dismissCriticalAlert(): void {
    this.criticalAlert.set(null);
  }

  onSaleModalClosed() {
    this.isSaleCompletedModalOpen = false;
  }

  openConflictsModal(): void {
    this.offlineService.reloadConflicts();
    this.isConflictsModalOpen.set(true);
  }

  closeConflictsModal(): void {
    this.isConflictsModalOpen.set(false);
  }

  async resolveConflictWithOverride(id: string) {
    const ok = await this.offlineService.resolveOverrideStock(id);
    if (ok && this.offlineService.conflictsCount() === 0) {
      this.closeConflictsModal();
    }
  }

  async resolveConflictWithCustomerReassign(id: string) {
    const ok = await this.offlineService.resolveReassignCustomer(id);
    if (ok && this.offlineService.conflictsCount() === 0) {
      this.closeConflictsModal();
    }
  }

  async resolveConflictWithRefund(id: string) {
    const reason = prompt('Ingrese el motivo de la anulación / devolución de efectivo:', 'Rechazo de regla offline') || 'Anulación de venta offline';
    const ok = await this.offlineService.resolveVoidAndRefund(id, reason);
    if (ok && this.offlineService.conflictsCount() === 0) {
      this.closeConflictsModal();
    }
  }
}
