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
import { WarehouseService } from '../../../inventory/services/warehouse.service';
import { StockService } from '../../../inventory/services/stock.service';
import { NcfAlertBannerComponent } from '../../../billing/components/ncf-alert-banner/ncf-alert-banner.component';
import { RealtimeAlertService } from '../../../cuadreEnv/services/realtime-alert.service';
import type { Warehouse } from '../../../../app/models/warehouse';

export interface QuickSaleItem {
  productId: number;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  taxRate?: number; // 18, 16, 0
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
    NcfAlertBannerComponent,
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
  readonly realtimeAlertService = inject(RealtimeAlertService);

  private cashRegisterService = inject(CashRegisterService);
  private productService = inject(ProductService);
  private customerService = inject(CustomerService);
  private categoryService = inject(CategoryService);
  private warehouseService = inject(WarehouseService);
  private stockService = inject(StockService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  isLoadingProducts = signal<boolean>(false);
  products = signal<ProductDto[]>([]);
  customers = signal<CustomerDto[]>([]);

  // Warehouse isolation
  warehouses = signal<Warehouse[]>([]);
  selectedWarehouseId = signal<number | null>(null);
  warehouseStockMap = signal<Map<number, number>>(new Map());

  selectedCustomerId: number | null = null;
  readonly selectedCustomer = computed(() => {
    const id = this.selectedCustomerId;
    if (!id) return null;
    return this.customers().find(c => c.id === id) || null;
  });
  catalogSearchTerm = signal<string>('');
  selectedCategory = signal<number | null>(null);

  // Cart & Active Item Selection (Keyboard Shortcuts)
  cartItems = signal<QuickSaleItem[]>([]);
  selectedCartIndex = signal<number>(0);

  // Discounts & Payments
  discountType = signal<'percent' | 'fixed'>('percent');
  discountValue = signal<number>(0);

  // Impuestos diferenciados, Propina Legal (10%) y Retenciones
  applyLegalTip = signal<boolean>(false);
  retentionItbisRate = signal<number>(0); // 0, 30, 100
  retentionIsrRate = signal<number>(0);   // 0, 2, 10

  selectedMethod = signal<string>('Efectivo');
  amountReceived = signal<number>(0);

  // Manejo Dual de Monedas (RD$ / USD) con Tasa Banco Central
  cashCurrency = signal<'DOP' | 'USD'>('DOP');
  usdExchangeRate = signal<number>(60.50);
  amountReceivedUsd = signal<number>(0);

  // Card details
  cardType = signal<'DEBIT' | 'CREDIT'>('DEBIT');
  cardLastFour = signal<string>('');
  cardAuthVoucher = signal<string>('');

  // Transfer details & Instant Bank Channels (QR Local)
  readonly bankChannels = [
    { id: 'POPULAR', name: 'Banco Popular', account: '792019481', type: 'Cta. Corriente', color: 'primary', icon: '🏦' },
    { id: 'QIK', name: 'Qik Banco Digital', account: '109284192', type: 'Cta. Instantánea QR', color: 'dark', icon: '⚡' },
    { id: 'BHD', name: 'Banco BHD', account: '284918239', type: 'Cta. Ahorros', color: 'success', icon: '🟢' },
    { id: 'BANRESERVAS', name: 'Banreservas', account: '960192841', type: 'Cta. Corriente', color: 'danger', icon: '🔴' },
    { id: 'ACH', name: 'Transferencia ACH', account: 'Interbancaria RNC 132-94812-1', type: 'ACH Inmediato', color: 'info', icon: '🌐' }
  ];
  selectedBankChannel = signal<string>('POPULAR');

  readonly currentBankProfile = computed(() => {
    return this.bankChannels.find(b => b.id === this.selectedBankChannel()) || this.bankChannels[0];
  });

  readonly transferQrUrl = computed(() => {
    const bank = this.currentBankProfile();
    const totalAmount = this.total().toFixed(2);
    const payload = `PAGO_CUADRE_POS|BANCO:${bank.name}|CTA:${bank.account}|MONTO_RD:${totalAmount}|RNC:132-94812-1|CLIENTE:${encodeURIComponent(this.selectedCustomer()?.name || 'Consumidor Final')}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
  });

  selectBankChannel(id: string): void {
    this.selectedBankChannel.set(id);
    const bank = this.bankChannels.find(b => b.id === id);
    if (bank) {
      this.transferBank.set(`${bank.name} (${bank.account})`);
    }
  }

  copyPaymentDetails(textToCopy: string, label: string): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      this.notificationService.success(`${label} copiado al portapapeles.`);
    }
  }

  sendPaymentViaWhatsApp(): void {
    const bank = this.currentBankProfile();
    const phone = this.selectedCustomer()?.phone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const amountStr = this.total().toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const message = `👋 *Hola${this.selectedCustomer()?.name ? ' ' + this.selectedCustomer()?.name : ''}!*
Para completar tu compra en *CuadreEnv POS*, aquí tienes los datos para tu transferencia inmediata:

💵 *Monto exacto a transferir:* RD$ ${amountStr}
🏦 *Banco Destino:* ${bank.name}
💳 *Número de Cuenta:* ${bank.account} (${bank.type})
🏢 *Beneficiario / RNC:* CuadreEnv Soluciones (RNC 132-94812-1)

📲 _Por favor, envíanos el comprobante o captura de la transferencia por aquí para entregarte tu factura fiscal e-CF._ ¡Muchas gracias!`;

    const encodedMsg = encodeURIComponent(message);
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('1') ? cleanPhone : '1' + cleanPhone}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;

    window.open(waUrl, '_blank');
  }

  transferBank = signal<string>('Banco Popular (792019481)');
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
    const sub = this.subtotal();
    const disc = this.discountAmount();
    const factor = sub > 0 ? Math.max(0, (sub - disc) / sub) : 1;
    return Math.round(
      this.cartItems().reduce((acc, item) => {
        const rate = item.taxRate !== undefined ? item.taxRate : 18;
        return acc + (item.total * factor * (rate / 100));
      }, 0) * 100,
    ) / 100;
  });

  readonly legalTipAmount = computed(() => {
    return this.applyLegalTip() ? Math.round(this.subtotal() * 0.10 * 100) / 100 : 0;
  });

  readonly retentionItbisAmount = computed(() => {
    const rate = this.retentionItbisRate();
    return rate > 0 ? Math.round(this.itbis() * (rate / 100) * 100) / 100 : 0;
  });

  readonly retentionIsrAmount = computed(() => {
    const rate = this.retentionIsrRate();
    return rate > 0 ? Math.round(this.subtotal() * (rate / 100) * 100) / 100 : 0;
  });

  readonly total = computed(() => {
    return Math.max(0, this.subtotal() - this.discountAmount() + this.itbis());
  });

  readonly netPayable = computed(() => {
    return Math.max(
      0,
      Math.round(
        (this.total() + this.legalTipAmount() - this.retentionItbisAmount() - this.retentionIsrAmount()) * 100,
      ) / 100,
    );
  });

  readonly totalInUsd = computed(() => {
    const rate = this.usdExchangeRate() || 1;
    return Math.round((this.netPayable() / rate) * 100) / 100;
  });

  readonly effectiveAmountReceivedDop = computed(() => {
    if (this.selectedMethod() !== 'Efectivo') return this.netPayable();
    if (this.cashCurrency() === 'USD') {
      const usd = Number(this.amountReceivedUsd()) || 0;
      return Math.round(usd * this.usdExchangeRate() * 100) / 100;
    }
    return Number(this.amountReceived()) || 0;
  });

  readonly change = computed(() => {
    if (this.selectedMethod() !== 'Efectivo') return 0;
    const received = this.effectiveAmountReceivedDop();
    const tot = this.netPayable();
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
  // Keyboard Shortcuts (WCAG & Ergonomic Fast POS: F2, F4, F8, Enter, + / -)
  // =========================================================================
  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    const tagName = (activeEl?.tagName || '').toLowerCase();
    const inputType = (activeEl as HTMLInputElement)?.type || '';
    const isTextInput = (tagName === 'input' && (inputType === 'text' || inputType === 'search' || inputType === 'password')) || tagName === 'textarea';

    // F2: Buscar producto / Focus en lector de código de barras
    if (event.key === 'F2') {
      event.preventDefault();
      this.focusCatalogSearch();
      return;
    }

    // F4: Abrir pantalla / sección de cobro
    if (event.key === 'F4') {
      event.preventDefault();
      if (this.cartItems().length > 0) {
        this.openPaymentSection();
      } else {
        this.notificationService.warning('Agrega productos al carrito antes de cobrar (F4).');
      }
      return;
    }

    // F8: Poner venta en espera
    if (event.key === 'F8') {
      event.preventDefault();
      this.holdCurrentSale();
      return;
    }

    // F9: Abrir ventas en espera
    if (event.key === 'F9') {
      event.preventDefault();
      this.openHeldSalesModal();
      return;
    }

    // Enter: Confirmar cobro en efectivo exacto
    if (event.key === 'Enter') {
      // Si el cajero está en el buscador de productos o escáner, dejamos que onSearchKeydown maneje la búsqueda
      if (activeEl === this.catalogSearchInputRef?.nativeElement) {
        return;
      }

      // Si está en otro campo de texto que no sea el monto recibido, respetamos el Enter estándar
      if (isTextInput && activeEl !== this.amountReceivedInputRef?.nativeElement) {
        return;
      }

      if (this.cartItems().length > 0) {
        event.preventDefault();
        // Si el método es efectivo y no se ha digitado monto o es menor al total, aplicar efectivo exacto automáticamente
        if (this.selectedMethod() === 'Efectivo') {
          if (!this.amountReceived() || this.amountReceived() < this.total()) {
            this.amountReceived.set(this.total());
          }
        }
        void this.processQuickSale();
      }
      return;
    }

    // + / -: Incrementar o disminuir cantidad del ítem seleccionado
    const isPlus = event.key === '+' || event.key === 'Add' || (event.key === '=' && event.shiftKey) || event.code === 'NumpadAdd';
    const isMinus = event.key === '-' || event.key === 'Subtract' || event.code === 'NumpadSubtract';

    if (isPlus && (!isTextInput || event.code === 'NumpadAdd')) {
      if (this.cartItems().length > 0) {
        event.preventDefault();
        this.incrementSelectedCartItem();
      }
      return;
    }

    if (isMinus && (!isTextInput || event.code === 'NumpadSubtract')) {
      if (this.cartItems().length > 0) {
        event.preventDefault();
        this.decrementSelectedCartItem();
      }
      return;
    }

    // Flechas arriba/abajo para navegar ítems del carrito
    if (!isTextInput && tagName !== 'select') {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (this.cartItems().length > 0) {
          this.selectedCartIndex.update((i) => Math.max(0, i - 1));
        }
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (this.cartItems().length > 0) {
          this.selectedCartIndex.update((i) => Math.min(this.cartItems().length - 1, i + 1));
        }
        return;
      }
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
      const [prodRes, custRes, catRes, sessionRes, whRes] = await Promise.all([
        this.productService.getPagedProducts(1, 100),
        this.customerService.getCustomers({ pageNumber: 1, pageSize: 100 } as any),
        this.categoryService.getCategories(),
        this.cashRegisterService.getActiveSession(),
        this.warehouseService.getWarehouses(),
      ]);

      const prodList = prodRes?.data?.items || (Array.isArray(prodRes?.data) ? prodRes.data : []);
      if (prodList && prodList.length > 0) {
        this.products.set(prodList);
      }
      const rawCustData = custRes?.data as any;
      const custList = Array.isArray(rawCustData) ? rawCustData : (rawCustData?.items || []);
      if (custList && custList.length > 0) {
        this.customers.set(custList);
      }
      if (catRes?.success && Array.isArray(catRes.data) && catRes.data.length > 0) {
        const dynamicCats = catRes.data.map((c: any) => ({
          id: c.id,
          label: c.description || c.name || `Categoría #${c.id}`,
        }));
        this.categories.set([{ id: null, label: 'Todos' }, ...dynamicCats]);
      }

      // Warehouse isolation
      if (whRes?.success && whRes.data && whRes.data.length > 0) {
        this.warehouses.set(whRes.data);
        const mainWh = whRes.data.find((w) => w.isMain) || whRes.data[0];
        this.selectedWarehouseId.set(mainWh.id);
        await this.loadWarehouseStock(mainWh.id);
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

  async loadWarehouseStock(warehouseId: number) {
    try {
      const stockRes = await this.stockService.getStock({ warehouseId });
      const map = new Map<number, number>();
      (stockRes.data || []).forEach((s) => {
        map.set(s.productId, s.quantity);
      });
      this.warehouseStockMap.set(map);
    } catch {
      // fallback
    }
  }

  async onWarehouseChange(whId: number) {
    this.selectedWarehouseId.set(whId);
    await this.loadWarehouseStock(whId);
  }

  getProductAvailableStock(productId: number): number {
    const whId = this.selectedWarehouseId();
    if (!whId) return 0;
    const map = this.warehouseStockMap();
    if (map.has(productId)) {
      return map.get(productId) || 0;
    }
    const p = this.products().find((prod) => prod.id === productId);
    return p?.stock || 0;
  }

  async quickOpenCashRegister() {
    this.isLoading.set(true);
    try {
      const res = await this.cashRegisterService.openSession({
        name: 'Caja Principal POS',
        initialAmount: 0,
        cashierName: 'Cajero POS',
      });
      if (res.success && res.data) {
        this.activeSessionName.set(`Caja #${res.data.id || 1} (Turno Abierto)`);
        this.hasOpenSession.set(true);
        this.isOpenSessionModalVisible.set(false);
        this.notificationService.success('Turno de caja aperturado correctamente.');
      } else {
        this.notificationService.error(res.message || 'No se pudo abrir la caja.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
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
  // Cart Actions & Active Item Selection (Keyboard & Touch)
  // =========================================================================
  selectCartItem(index: number): void {
    if (index >= 0 && index < this.cartItems().length) {
      this.selectedCartIndex.set(index);
    }
  }

  incrementSelectedCartItem(): void {
    const idx = this.selectedCartIndex();
    if (this.cartItems().length > 0 && idx >= 0 && idx < this.cartItems().length) {
      this.incrementQuantity(idx);
    }
  }

  decrementSelectedCartItem(): void {
    const idx = this.selectedCartIndex();
    if (this.cartItems().length > 0 && idx >= 0 && idx < this.cartItems().length) {
      this.decrementQuantity(idx);
    }
  }

  addProductToCart(product: ProductDto) {
    if (!this.selectedWarehouseId()) {
      this.notificationService.warning('Seleccione un almacén de despacho.');
      return;
    }

    const available = this.getProductAvailableStock(product.id!);
    const existingIdx = this.cartItems().findIndex(
      (item) => item.productId === product.id,
    );
    const currentQtyInCart = existingIdx >= 0 ? this.cartItems()[existingIdx].quantity : 0;

    if (!product.invoiceWithoutStock && currentQtyInCart + 1 > available) {
      const whName = this.warehouses().find((w) => w.id === this.selectedWarehouseId())?.name || 'el almacén';
      this.notificationService.warning(`Stock insuficiente en ${whName}. Disponible: ${available} uds.`);
      return;
    }

    const price = product.cost ? Number(product.cost) : 100;
    const code = product.barcode || product.reference || `PROD-${String(product.id || 1).padStart(4, '0')}`;
    const name = product.description || product.shortDescription || 'Producto';
    const taxRate = (product as any).taxRate !== undefined ? Number((product as any).taxRate) : 18;

    if (existingIdx >= 0) {
      const items = [...this.cartItems()];
      items[existingIdx].quantity += 1;
      items[existingIdx].total = items[existingIdx].quantity * items[existingIdx].unitPrice;
      this.cartItems.set(items);
      this.selectedCartIndex.set(existingIdx);
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
          taxRate: taxRate,
        },
      ]);
      this.selectedCartIndex.set(this.cartItems().length - 1);
    }

    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.netPayable());
    }
  }

  openDrawerManual() {
    this.realtimeAlertService.triggerDrawerOpenedNoSale(
      this.activeSessionName(),
      'Cajero POS',
    );
    this.notificationService.info('Apertura de gaveta ejecutada (Alerta de auditoría emitida al administrador).');
  }

  incrementQuantity(index: number) {
    const items = [...this.cartItems()];
    const it = items[index];
    if (!it) return;
    const product = this.products().find((p) => p.id === it.productId);
    const available = this.getProductAvailableStock(it.productId);

    if (product && !product.invoiceWithoutStock && it.quantity + 1 > available) {
      const whName = this.warehouses().find((w) => w.id === this.selectedWarehouseId())?.name || 'el almacén';
      this.notificationService.warning(`No puedes agregar más unidades. Disponible en ${whName}: ${available} uds.`);
      return;
    }

    it.quantity += 1;
    it.total = it.quantity * it.unitPrice;
    this.cartItems.set(items);
    this.selectedCartIndex.set(index);
    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  decrementQuantity(index: number) {
    const items = [...this.cartItems()];
    if (!items[index]) return;
    if (items[index].quantity > 1) {
      items[index].quantity -= 1;
      items[index].total = items[index].quantity * items[index].unitPrice;
      this.cartItems.set(items);
      this.selectedCartIndex.set(index);
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
    if (!items[index]) return;
    items[index].quantity = val;
    items[index].total = items[index].unitPrice * val;
    this.cartItems.set(items);
    this.selectedCartIndex.set(index);
    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  removeCartItem(index: number) {
    const items = [...this.cartItems()];
    items.splice(index, 1);
    this.cartItems.set(items);
    if (this.selectedCartIndex() >= items.length) {
      this.selectedCartIndex.set(Math.max(0, items.length - 1));
    }
    if (this.selectedMethod() !== 'Efectivo') {
      this.amountReceived.set(this.total());
    }
  }

  clearCart() {
    this.cartItems.set([]);
    this.selectedCartIndex.set(0);
    this.amountReceived.set(0);
    this.draftStorageService.clearActiveDraft();
  }

  // =========================================================================
  // Modo "Cajero Relámpago": Fast Keyboard & Touch POS Actions
  // =========================================================================
  focusCatalogSearch(): void {
    if (this.catalogSearchInputRef?.nativeElement) {
      this.catalogSearchInputRef.nativeElement.focus();
      this.catalogSearchInputRef.nativeElement.select();
    }
  }

  openPaymentSection(): void {
    if (this.cartItems().length === 0) {
      this.notificationService.warning('Agrega productos al carrito antes de cobrar (F4).');
      return;
    }
    if (this.selectedMethod() === 'Efectivo') {
      if (!this.amountReceived() || this.amountReceived() === 0) {
        this.amountReceived.set(this.total());
      }
      setTimeout(() => {
        this.amountReceivedInputRef?.nativeElement?.focus();
        this.amountReceivedInputRef?.nativeElement?.select();
      }, 50);
    } else {
      this.notificationService.info(`Cobro con ${this.selectedMethod()}. Presione Enter para confirmar.`);
    }
  }

  confirmExactCashFromShortcut(): void {
    if (this.cartItems().length === 0) {
      this.notificationService.warning('Agrega productos al carrito antes de cobrar.');
      return;
    }
    if (this.selectedMethod() === 'Efectivo') {
      this.amountReceived.set(this.total());
    }
    void this.processQuickSale();
  }

  applyQuickCash(amount: number | 'exact'): void {
    if (amount === 'exact') {
      this.amountReceived.set(this.total());
    } else {
      this.amountReceived.set(amount);
    }
  }

  setCashCurrency(curr: 'DOP' | 'USD'): void {
    this.cashCurrency.set(curr);
    if (curr === 'USD') {
      const minUsd = Math.ceil(this.total() / (this.usdExchangeRate() || 1));
      this.amountReceivedUsd.set(minUsd);
    } else {
      this.amountReceived.set(this.total());
    }
  }

  setUsdExchangeRate(rate: number): void {
    const r = Math.max(1, Number(rate) || 60.50);
    this.usdExchangeRate.set(r);
  }

  applyQuickUsd(amount: number): void {
    this.amountReceivedUsd.set(amount);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const rawTerm = (this.catalogSearchTerm() || '').trim();
      if (!rawTerm) return;
      const term = rawTerm.toLowerCase();

      // 1. Check exact barcode match first
      const exactBarcode = this.products().find((p) => {
        const barcode = (p.barcode || '').trim().toLowerCase();
        const ref = (p.reference || '').trim().toLowerCase();
        return barcode === term || ref === term;
      });

      if (exactBarcode) {
        this.addProductToCart(exactBarcode);
        this.catalogSearchTerm.set('');
        return;
      }

      // 2. Check filtered catalog items
      const filtered = this.filteredCatalogProducts();
      if (filtered.length > 0) {
        this.addProductToCart(filtered[0]);
        this.catalogSearchTerm.set('');
        return;
      }

      this.notificationService.warning(`No se encontró ningún producto con el código o término "${rawTerm}".`);
    }
  }

  getProductCategoryIcon(categoryId?: number | null, description?: string | null): string {
    const desc = (description || '').toLowerCase();
    if (
      desc.includes('coca') ||
      desc.includes('agua') ||
      desc.includes('jugo') ||
      desc.includes('cerveza') ||
      desc.includes('soda') ||
      desc.includes('bebida') ||
      desc.includes('refresco')
    ) {
      return '🥤';
    }
    if (
      desc.includes('pan') ||
      desc.includes('queso') ||
      desc.includes('arroz') ||
      desc.includes('snack') ||
      desc.includes('galleta') ||
      desc.includes('comida') ||
      desc.includes('sandwich') ||
      desc.includes('cafe')
    ) {
      return '🍔';
    }
    if (
      desc.includes('cable') ||
      desc.includes('usb') ||
      desc.includes('cargador') ||
      desc.includes('bateria') ||
      desc.includes('teclado') ||
      desc.includes('mouse') ||
      desc.includes('celular')
    ) {
      return '🔌';
    }
    if (
      desc.includes('jabon') ||
      desc.includes('cloro') ||
      desc.includes('limpia') ||
      desc.includes('papel') ||
      desc.includes('detergente') ||
      desc.includes('shampoo')
    ) {
      return '🧼';
    }
    if (
      desc.includes('martillo') ||
      desc.includes('clavo') ||
      desc.includes('tornillo') ||
      desc.includes('pintura') ||
      desc.includes('herramienta') ||
      desc.includes('tubo')
    ) {
      return '🔧';
    }
    if (
      desc.includes('pastilla') ||
      desc.includes('jarabe') ||
      desc.includes('alcohol') ||
      desc.includes('aspirina') ||
      desc.includes('medicina')
    ) {
      return '💊';
    }
    switch (categoryId) {
      case 2:
        return '🍔';
      case 3:
        return '🥤';
      case 4:
        return '📄';
      case 5:
        return '🛠️';
      default:
        return '📦';
    }
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
      const received = this.effectiveAmountReceivedDop();
      if (received < this.netPayable()) {
        this.notificationService.warning('El monto recibido no puede ser menor al total neto a pagar.');
        if (this.cashCurrency() !== 'USD') {
          this.amountReceivedInputRef?.nativeElement?.focus();
        }
        return;
      }
      if (this.cashCurrency() === 'USD') {
        paymentDetailsNote = `Efectivo USD $${this.amountReceivedUsd()} (Tasa 1 USD = RD$ ${this.usdExchangeRate()}) Equiv: RD$ ${received.toFixed(2)}`;
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
      legalTip: this.legalTipAmount(),
      retentionItbis: this.retentionItbisAmount(),
      retentionIsr: this.retentionIsrAmount(),
      total: this.netPayable(),
      paymentMethod: paymentDetailsNote || this.selectedMethod(),
      amountReceived: this.selectedMethod() === 'Efectivo' ? this.effectiveAmountReceivedDop() : this.netPayable(),
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
          total: this.netPayable(),
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

        // Stock isolation deduction from chosen warehouse
        const whId = this.selectedWarehouseId();
        if (whId) {
          for (const it of this.cartItems()) {
            try {
              await this.stockService.updateStock(whId, it.productId, -it.quantity);
            } catch (stockErr) {
              console.warn('Error deducting stock from warehouse:', stockErr);
            }
          }
          await this.loadWarehouseStock(whId);
        }

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
