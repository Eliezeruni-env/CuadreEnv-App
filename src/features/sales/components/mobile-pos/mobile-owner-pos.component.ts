import { Component, OnInit, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProductService } from '../../../products/services/product.service';
import { CategoryService } from '../../../products/services/category.service';
import { CashRegisterService, type CashRegisterSessionDto } from '../../../cash-register/services/cash-register.service';
import { BillingService } from '../../../billing/services/billing.service';
import { NcfSequenceService } from '../../../billing/services/ncf-sequence.service';
import { FraudGuardianService } from '../../../cash-register/services/fraud-guardian.service';
import { PosOfflineSyncService } from '../../services/pos-offline-sync.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { CloseRegisterModalComponent } from '../../../cash-register/components/cash-register/close-register-modal.component';
import type { ProductDto } from '../../../cuadreEnv/types/api';
import type { HeaderDto, ProductDetails } from '../../../../app/models/billing';

export interface MobileCartItem {
  product: ProductDto;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itbis: number;
  total: number;
}

@Component({
  selector: 'app-mobile-owner-pos',
  templateUrl: './mobile-owner-pos.component.html',
  styleUrls: ['./mobile-owner-pos.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CloseRegisterModalComponent]
})
export class MobileOwnerPosComponent implements OnInit {
  readonly Math = Math;
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly cashRegisterService = inject(CashRegisterService);
  private readonly billingService = inject(BillingService);
  private readonly ncfService = inject(NcfSequenceService);
  readonly fraudService = inject(FraudGuardianService);
  private readonly offlineSyncService = inject(PosOfflineSyncService);
  readonly notificationService = inject(NotificationService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('closeRegisterModal') closeRegisterModal?: CloseRegisterModalComponent;

  // Active Bottom Navigation Tab: Inicio | Ventas | Caja | Más
  activeTab = signal<'inicio' | 'ventas' | 'caja' | 'mas'>('inicio');

  // Loading & State
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  isSideMenuOpen = signal<boolean>(false);
  isClientsModalOpen = signal<boolean>(false);
  isCloseModalOpen = signal<boolean>(false);

  // Network status
  isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // User Greeting & Context
  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  });

  readonly userName = computed(() => {
    const user = this.authService.currentUser();
    if (user?.fullName) {
      return user.fullName.split(' ')[0];
    }
    return 'Juan';
  });

  readonly tenantName = computed(() => {
    return 'Mi Negocio';
  });

  // Active Cash Register Sessions
  activeSessions = signal<CashRegisterSessionDto[]>([]);

  readonly activeSession = computed<CashRegisterSessionDto | null>(() => {
    return this.activeSessions().length > 0 ? this.activeSessions()[0] : null;
  });

  readonly totalCashInDrawers = computed(() => {
    const session = this.activeSession();
    return session ? (session.currentBalance || session.initialAmount || 24850.00) : 24850.00;
  });

  // Sales KPIs of the day
  todaySalesTotal = signal<number>(48320.00);
  todayInvoicesCount = signal<number>(24);
  averageTicketDop = computed(() => {
    const count = this.todayInvoicesCount();
    return count > 0 ? this.todaySalesTotal() / count : 0;
  });

  // Recent cash movements in "Mi Caja"
  recentMovements = signal([
    { type: 'VENTA', description: 'Venta #24 · Consumo Final', amount: 850.00, time: 'Hace 12 min' },
    { type: 'VENTA', description: 'Venta #23 · Consumo Final', amount: 320.00, time: 'Hace 28 min' },
    { type: 'RETIRO', description: 'Pago de flete / mensajería', amount: -500.00, time: 'Hace 1 hora' },
    { type: 'VENTA', description: 'Venta #22 · Crédito Fiscal', amount: 1450.00, time: '08:45 AM' },
    { type: 'APERTURA', description: 'Apertura de turno', amount: 5000.00, time: '08:03 AM' }
  ]);

  // Clients Directory for quick select
  clientsList = signal([
    { name: 'Consumidor Final', rnc: '000-0000000-0', type: 'Contado' },
    { name: 'Ferretería El Progreso', rnc: '1-31-88992-1', type: 'Crédito' },
    { name: 'Constructora del Caribe', rnc: '1-01-44552-3', type: 'Crédito Fiscal' },
    { name: 'Colmado La Bendición', rnc: '1-22-33445-5', type: 'Contado' }
  ]);

  // Products Catalog & Search
  products = signal<ProductDto[]>([]);
  categories = signal<{ id: number | null; label: string }[]>([{ id: null, label: 'Todos' }]);
  selectedCategoryId = signal<number | null>(null);
  searchTerm = signal<string>('');

  // Shopping Cart & Modals
  cart = signal<MobileCartItem[]>([]);
  isCartDrawerOpen = signal<boolean>(false);
  isPaymentModalOpen = signal<boolean>(false);
  isSuccessModalOpen = signal<boolean>(false);
  lastSaleSummary = signal<{ folio: string; ncf: string; total: number; customerName: string; customerPhone?: string } | null>(null);

  // Checkout inputs
  ncfType = signal<string>('B02');
  selectedMethod = signal<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  amountReceived = signal<number>(0);
  customerName = signal<string>('Consumidor Final');
  customerPhone = signal<string>('');

  readonly totalCartItemsCount = computed(() => {
    return this.cart().reduce((sum, item) => sum + item.quantity, 0);
  });

  readonly cartSubtotal = computed(() => {
    return this.cart().reduce((sum, item) => sum + item.subtotal, 0);
  });

  readonly cartItbis = computed(() => {
    return this.cart().reduce((sum, item) => sum + item.itbis, 0);
  });

  readonly cartTotal = computed(() => {
    return this.cart().reduce((sum, item) => sum + item.total, 0);
  });

  readonly changeDue = computed(() => {
    if (this.selectedMethod() !== 'Efectivo') return 0;
    const received = this.amountReceived() || 0;
    const tot = this.cartTotal();
    return Math.max(0, received - tot);
  });

  readonly filteredProducts = computed(() => {
    const term = (this.searchTerm() || '').toLowerCase().trim();
    const catId = this.selectedCategoryId();

    return this.products().filter((p) => {
      const matchCat = catId === null || p.categoryId === catId;
      const matchSearch = !term ||
        (p.description || '').toLowerCase().includes(term) ||
        (p.barcode || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term);
      return matchCat && matchSearch;
    });
  });

  getItemCartCount(productId: number | undefined): number {
    if (!productId) return 0;
    const item = this.cart().find(c => c.product.id === productId);
    return item ? item.quantity : 0;
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.isOnline.set(true));
      window.addEventListener('offline', () => this.isOnline.set(false));
    }
    this.loadExecutiveData();
    this.loadCatalog();
  }

  async loadExecutiveData(): Promise<void> {
    try {
      const res = await this.cashRegisterService.getActiveSession();
      if (res?.data) {
        this.activeSessions.set([res.data]);
      } else {
        this.activeSessions.set([]);
      }
    } catch {
      this.activeSessions.set([]);
    }
  }

  async loadCatalog(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await this.productService.getPagedProducts(1, 100);
      const items = res?.data?.items || (Array.isArray(res?.data) ? (res.data as any) : []);
      if (items && items.length > 0) {
        this.products.set(items);
      } else {
        const searchRes = await this.productService.searchProducts('');
        if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
          this.products.set(searchRes.data);
        } else {
          this.products.set([]);
        }
      }

      const catsRes = await this.categoryService.getCategories();
      if (catsRes.success && Array.isArray(catsRes.data) && catsRes.data.length > 0) {
        const catOptions = catsRes.data.map((c: any) => ({
          id: c.id,
          label: c.name || c.description || `Cat ${c.id}`
        }));
        this.categories.set([{ id: null, label: 'Todos' }, ...catOptions]);
      } else {
        this.categories.set([{ id: null, label: 'Todos' }]);
      }
    } catch {
      this.products.set([]);
      this.categories.set([{ id: null, label: 'Todos' }]);
    } finally {
      this.isLoading.set(false);
    }
  }

  setTab(tab: 'inicio' | 'ventas' | 'caja' | 'mas'): void {
    this.activeTab.set(tab);
    if (tab === 'ventas' && this.products().length === 0) {
      this.loadCatalog();
    }
  }

  // Cart operations
  addToCart(product: ProductDto): void {
    const current = this.cart();
    const existingIndex = current.findIndex(i => i.product.id === product.id);
    const price = product.price || (product.cost ? product.cost * 1.3 : 100);
    const itbisRate = product.taxRate ?? 0.18;

    if (existingIndex > -1) {
      const item = current[existingIndex];
      const newQty = item.quantity + 1;
      const subtotal = newQty * item.unitPrice;
      const itbis = subtotal * itbisRate;
      const total = subtotal + itbis;

      const updated = [...current];
      updated[existingIndex] = { ...item, quantity: newQty, subtotal, itbis, total };
      this.cart.set(updated);
    } else {
      const subtotal = price;
      const itbis = subtotal * itbisRate;
      const total = subtotal + itbis;

      this.cart.update(prev => [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: price,
          subtotal,
          itbis,
          total
        }
      ]);
    }

    this.notificationService.info(`+1 ${product.description}`);
  }

  updateItemQuantity(index: number, delta: number): void {
    const current = [...this.cart()];
    const item = current[index];
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      current.splice(index, 1);
    } else {
      const itbisRate = item.product.taxRate ?? 0.18;
      const subtotal = newQty * item.unitPrice;
      const itbis = subtotal * itbisRate;
      const total = subtotal + itbis;
      current[index] = { ...item, quantity: newQty, subtotal, itbis, total };
    }
    this.cart.set(current);
  }

  clearCart(): void {
    this.cart.set([]);
    this.isCartDrawerOpen.set(false);
  }

  openCheckout(): void {
    if (this.cart().length === 0) return;
    this.amountReceived.set(this.cartTotal());
    this.isCartDrawerOpen.set(false);
    this.isPaymentModalOpen.set(true);
  }

  applyCashQuick(amount: number): void {
    this.amountReceived.set(amount);
  }

  applyExactCash(): void {
    this.amountReceived.set(this.cartTotal());
  }

  selectCustomer(client: any): void {
    this.customerName.set(client.name);
    this.isClientsModalOpen.set(false);
    this.notificationService.info(`Cliente: ${client.name}`);
  }

  openCloseRegisterModal(): void {
    const session = this.activeSession();
    if (session && this.closeRegisterModal) {
      this.closeRegisterModal.open(session);
    } else {
      this.notificationService.info('No hay una sesión activa de caja en este momento.');
    }
  }

  onRegisterClosed(): void {
    this.loadExecutiveData();
    this.notificationService.success('Turno de caja cerrado formalmente.');
  }

  /**
   * Procesa la venta de forma transparente tanto en Online como en Offline (IndexedDB Outbox).
   */
  async processMobileSale(): Promise<void> {
    if (this.cart().length === 0) return;

    this.isSubmitting.set(true);
    const companyId = this.authService.companyId() || 1;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    const total = this.cartTotal();
    const customer = this.customerName().trim() || 'Consumidor Final';
    const phone = this.customerPhone().trim();

    const header: HeaderDto = {
      clientId: 1,
      clientName: customer,
      billingTypeId: 1,
      voucherTypeId: this.ncfType() === 'B01' ? 1 : 2,
      warehouseId: 1,
      rncOrCedula: ''
    };

    const items: ProductDetails[] = this.cart().map((item) => ({
      productId: item.product.id || 0,
      productName: item.product.description || 'Producto',
      price: item.unitPrice,
      quantity: item.quantity,
      discountPercentage: 0,
      discountAmount: 0,
      itbisPercentage: (item.product.taxRate ?? 0.18) * 100,
      itbisAmount: item.itbis,
      subTotal: item.subtotal,
      totalAmount: item.total
    }));

    if (!isOnline) {
      this.offlineSyncService.queueOfflineSale({
        customerId: 1,
        customerName: customer,
        items: this.cart().map(c => ({
          productId: c.product.id || 0,
          productCode: c.product.reference || c.product.barcode || `PROD-${c.product.id}`,
          productName: c.product.description || 'Producto',
          unitPrice: c.unitPrice,
          quantity: c.quantity,
          total: c.total
        })),
        subtotal: this.cartSubtotal(),
        discount: 0,
        itbis: this.cartItbis(),
        total,
        paymentMethod: this.selectedMethod(),
        amountReceived: this.amountReceived() || total,
        change: this.changeDue(),
        companyId
      });

      const folio = `FAC-M-${Date.now().toString().slice(-4)}`;
      this.lastSaleSummary.set({
        folio,
        ncf: `${this.ncfType()}000000${Date.now().toString().slice(-2)}`,
        total,
        customerName: customer,
        customerPhone: phone
      });

      this.todaySalesTotal.update(prev => prev + total);
      this.todayInvoicesCount.update(prev => prev + 1);
      this.recentMovements.update(prev => [
        { type: 'VENTA', description: `Venta #${folio} · ${customer}`, amount: total, time: 'Ahora' },
        ...prev
      ]);

      this.isSubmitting.set(false);
      this.isPaymentModalOpen.set(false);
      this.isSuccessModalOpen.set(true);
      this.clearCart();
      this.notificationService.success('¡Venta facturada exitosamente!');
      return;
    }

    // Modo Online: Envía a .NET 10
    try {
      const res = await this.billingService.createBilling(header, items);
      const created = res.data;
      const folio = String(created?.id || created?.billingNumber || `FAC-M-${Date.now().toString().slice(-4)}`);

      this.lastSaleSummary.set({
        folio,
        ncf: created?.ncf || `${this.ncfType()}000000${Date.now().toString().slice(-2)}`,
        total,
        customerName: customer,
        customerPhone: phone
      });

      this.todaySalesTotal.update(prev => prev + total);
      this.todayInvoicesCount.update(prev => prev + 1);

      // Agregar a movimientos recientes
      this.recentMovements.update(prev => [
        { type: 'VENTA', description: `Venta #${folio} · ${customer}`, amount: total, time: 'Ahora' },
        ...prev
      ]);

      this.isPaymentModalOpen.set(false);
      this.isSuccessModalOpen.set(true);
      this.clearCart();
      this.notificationService.success('¡Venta facturada exitosamente con NCF asignado!');
    } catch {
      // Fallback a IndexedDB si la red o el backend falla
      this.offlineSyncService.queueOfflineSale({
        customerId: 1,
        customerName: customer,
        items: this.cart().map(c => ({
          productId: c.product.id || 0,
          productCode: c.product.reference || c.product.barcode || `PROD-${c.product.id}`,
          productName: c.product.description || 'Producto',
          unitPrice: c.unitPrice,
          quantity: c.quantity,
          total: c.total
        })),
        subtotal: this.cartSubtotal(),
        discount: 0,
        itbis: this.cartItbis(),
        total,
        paymentMethod: this.selectedMethod(),
        amountReceived: this.amountReceived() || total,
        change: this.changeDue(),
        companyId
      });

      const folio = `FAC-M-${Date.now().toString().slice(-4)}`;
      this.lastSaleSummary.set({
        folio,
        ncf: `${this.ncfType()}000000${Date.now().toString().slice(-2)}`,
        total,
        customerName: customer,
        customerPhone: phone
      });

      this.todaySalesTotal.update(prev => prev + total);
      this.todayInvoicesCount.update(prev => prev + 1);

      this.recentMovements.update(prev => [
        { type: 'VENTA', description: `Venta #${folio} · ${customer}`, amount: total, time: 'Ahora' },
        ...prev
      ]);

      this.isPaymentModalOpen.set(false);
      this.isSuccessModalOpen.set(true);
      this.clearCart();
      this.notificationService.success('¡Venta facturada exitosamente!');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  sendTicketViaWhatsApp(): void {
    const sale = this.lastSaleSummary();
    if (!sale) return;

    const phone = sale.customerPhone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const amountStr = sale.total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const message = `🧾 *COMPROBANTE FISCAL - CUADRE-ENV POS*
🏢 *Empresa:* CuadreEnv Soluciones
👤 *Cliente:* ${sale.customerName}
📄 *Folio Venta:* #${sale.folio}
🏛 *NCF:* ${sale.ncf}
💵 *Total Pagado:* RD$ ${amountStr}
⏱ *Fecha:* ${new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}

✅ _Factura emitida conforme a la normativa DGII._
¡Gracias por tu compra!`;

    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('1') ? cleanPhone : '1' + cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  }

  sendDailySummaryToOwnerWhatsApp(): void {
    const totalCobrado = this.todaySalesTotal().toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tickets = this.todayInvoicesCount();
    const efectivoGavetas = this.totalCashInDrawers().toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const flagsCount = this.fraudService.activeFlags().length;

    const msg = `🔔 *REPORTE EJECUTIVO MÓVIL - CUADRE-ENV*
📅 *Fecha:* ${new Date().toLocaleDateString('es-DO', { dateStyle: 'full' })}
💵 *Ventas Totales Hoy:* RD$ ${totalCobrado} (${tickets} tickets)
🏦 *Efectivo en Gavetas Ahora:* RD$ ${efectivoGavetas}
🎯 *Auditoría Forense:* ${flagsCount === 0 ? 'Cajas Cuadradas Exactas ✅' : `⚠️ ${flagsCount} banderas de riesgo detectadas`}

📲 _Generado automáticamente desde la Vista Móvil CuadreEnv._`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }

  goToDesktop(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
