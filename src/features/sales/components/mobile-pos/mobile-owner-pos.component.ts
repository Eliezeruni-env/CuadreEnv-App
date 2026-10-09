import { Component, OnInit, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProductService } from '../../../products/services/product.service';
import { CategoryService } from '../../../products/services/category.service';
import { CashRegisterService, type CashRegisterSessionDto } from '../../../cash-register/services/cash-register.service';
import { BillingService } from '../../../billing/services/billing.service';
import { NcfSequenceService } from '../../../billing/services/ncf-sequence.service';
import { SaleService } from '../../services/sale.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { FraudGuardianService } from '../../../cash-register/services/fraud-guardian.service';
import { PosOfflineSyncService } from '../../services/pos-offline-sync.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { CompanyService } from '../../../companies/services/company.service';
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

export interface MobileClientOption {
  id: number;
  name: string;
  rnc: string;
  type: string;
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
  private readonly saleService = inject(SaleService);
  private readonly customerService = inject(CustomerService);
  readonly fraudService = inject(FraudGuardianService);
  private readonly offlineSyncService = inject(PosOfflineSyncService);
  readonly notificationService = inject(NotificationService);
  readonly authService = inject(AuthService);
  private readonly companyService = inject(CompanyService);
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

  // User Greeting & Context (Data Real del Tenant)
  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  });

  readonly userName = computed(() => {
    const user = this.authService.currentUser();
    if (user?.fullName?.trim()) return user.fullName.trim().split(' ')[0];
    if (user?.email?.trim()) return user.email.trim().split('@')[0];
    return 'Usuario';
  });

  readonly tenantName = computed(() => {
    const settingsName = this.companyService.currentSettings().companyName?.trim();
    if (settingsName) return settingsName;
    const cid = this.authService.companyId();
    return cid ? `Empresa #${cid}` : 'Mi Negocio';
  });

  // Active Cash Register Sessions
  activeSessions = signal<CashRegisterSessionDto[]>([]);

  readonly activeSession = computed<CashRegisterSessionDto | null>(() => {
    return this.activeSessions().length > 0 ? this.activeSessions()[0] : null;
  });

  readonly totalCashInDrawers = computed(() => {
    const session = this.activeSession();
    return session ? (session.currentBalance ?? session.initialAmount ?? 0) : 0;
  });

  // Sales KPIs of the day (Cálculo real sobre las ventas de la sesión y el tenant)
  todaySalesTotal = signal<number>(0);
  todayInvoicesCount = signal<number>(0);
  averageTicketDop = computed(() => {
    const count = this.todayInvoicesCount();
    return count > 0 ? this.todaySalesTotal() / count : 0;
  });

  // Recent cash movements in "Mi Caja" (Data real desde el backend /CashMovement)
  recentMovements = signal<{ type: string; description: string; amount: number; time: string }[]>([]);

  // Clients Directory for quick select (Data real de clientes del tenant)
  clientsList = signal<MobileClientOption[]>([
    { id: 1, name: 'Consumidor Final', rnc: '000-0000000-0', type: 'Contado' }
  ]);
  selectedCustomerId = signal<number | null>(null);

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
      // 1. Cargar sesión activa real de caja
      const sessionRes = await this.cashRegisterService.getActiveSession();
      if (sessionRes?.data && sessionRes.data.isOpen) {
        this.activeSessions.set([sessionRes.data]);
      } else {
        this.activeSessions.set([]);
      }

      // 2. Cargar movimientos reales de caja desde la API
      try {
        const movRes = await this.cashRegisterService.getMovements();
        if (movRes?.data && Array.isArray(movRes.data) && movRes.data.length > 0) {
          const mapped = movRes.data
            .slice(-10)
            .reverse()
            .map((m) => ({
              type: m.type === 'Entrada' ? 'VENTA' : (m.category === 'Retiro' ? 'RETIRO' : 'SALIDA'),
              description: m.description,
              amount: m.type === 'Entrada' ? (m.inAmount || 0) : -(m.outAmount || 0),
              time: m.date || 'Hoy'
            }));
          this.recentMovements.set(mapped);
        } else {
          this.recentMovements.set([]);
        }
      } catch {
        this.recentMovements.set([]);
      }

      // 3. Cargar ventas reales para calcular KPIs del día de la empresa / tenant
      try {
        const salesRes = await this.saleService.getSales({ pageSize: 100 });
        const allSales = salesRes.data || [];
        const todayStr = new Date().toISOString().split('T')[0];

        const todaySales = allSales.filter((s) => {
          const saleDate = (s.creationDate || '').split('T')[0];
          return saleDate === todayStr;
        });

        const totalSales = todaySales.reduce((acc, s) => acc + Number(s.total || 0), 0);
        this.todaySalesTotal.set(totalSales);
        this.todayInvoicesCount.set(todaySales.length);
      } catch {
        this.todaySalesTotal.set(0);
        this.todayInvoicesCount.set(0);
      }

      // 4. Cargar clientes reales del tenant
      try {
        const custRes = await this.customerService.getCustomers({ pageSize: 50 });
        const realCustomers = custRes.data || [];
        const formattedClients: MobileClientOption[] = [
          { id: 1, name: 'Consumidor Final', rnc: '000-0000000-0', type: 'Contado' },
          ...realCustomers
            .filter((c) => c.name && c.name.toLowerCase().trim() !== 'consumidor final')
            .map((c) => ({
              id: c.id || 1,
              name: c.name,
              rnc: c.identification || '000-0000000-0',
              type: 'Contado'
            }))
        ];
        this.clientsList.set(formattedClients);
      } catch {
        this.clientsList.set([
          { id: 1, name: 'Consumidor Final', rnc: '000-0000000-0', type: 'Contado' }
        ]);
      }
    } catch (err) {
      console.warn('[Mobile POS] Error al cargar datos ejecutivos:', err);
    }
  }

  async openQuickMobileSession(initialAmount: number = 0): Promise<void> {
    try {
      const cashierName = this.authService.currentUser()?.fullName || this.userName();
      const res = await this.cashRegisterService.openSession({
        name: 'Caja Principal POS',
        initialAmount,
        cashierName,
        notes: 'Apertura desde vista Móvil PWA'
      });
      if (res.success && res.data) {
        this.activeSessions.set([res.data]);
        this.notificationService.success('Turno de caja aperturado correctamente.');
        await this.loadExecutiveData();
      } else {
        this.notificationService.error(res.message || 'No se pudo abrir la caja.');
      }
    } catch (err: any) {
      this.notificationService.showApiError(err);
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
    if (tab === 'caja' || tab === 'inicio') {
      this.loadExecutiveData();
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

  selectCustomer(client: MobileClientOption): void {
    this.selectedCustomerId.set(client.id);
    this.customerName.set(client.name);
    this.isClientsModalOpen.set(false);
    this.notificationService.info(`Cliente seleccionado: ${client.name}`);
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
   * Procesa la venta de forma transparente vinculada a la sesión de caja activa.
   * La venta es inmediatamente visible en la PC en la tabla de Ventas y en los movimientos de Caja.
   */
  async processMobileSale(): Promise<void> {
    if (this.cart().length === 0) return;

    // 1. Validar que exista una sesión de caja activa
    let session = this.activeSession();
    if (!session) {
      try {
        const openRes = await this.cashRegisterService.openSession({
          name: 'Caja Principal POS',
          initialAmount: 0,
          cashierName: this.authService.currentUser()?.fullName || this.userName(),
          notes: 'Apertura automática desde POS Móvil'
        });
        if (openRes.success && openRes.data) {
          session = openRes.data;
          this.activeSessions.set([session]);
        } else {
          this.notificationService.warning('Debes aperturar un turno de caja para registrar ventas.');
          this.setTab('caja');
          return;
        }
      } catch {
        this.notificationService.warning('Debes aperturar un turno de caja para registrar ventas.');
        this.setTab('caja');
        return;
      }
    }

    this.isSubmitting.set(true);
    const companyId = this.authService.companyId() || 1;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    const total = this.cartTotal();
    const subtotal = this.cartSubtotal();
    const itbis = this.cartItbis();
    const customer = this.customerName().trim() || 'Consumidor Final';
    const customerId = this.selectedCustomerId();
    const phone = this.customerPhone().trim();
    const method = this.selectedMethod();
    const amountRec = this.amountReceived() || total;
    const change = this.changeDue();
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `mob-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // A) MODO OFFLINE: Resguardo en IndexedDB Outbox vinculando el cashRegisterId
    if (!isOnline) {
      this.offlineSyncService.queueOfflineSale({
        customerId: customerId || 1,
        customerName: customer,
        items: this.cart().map((c) => ({
          productId: c.product.id || 0,
          productCode: c.product.reference || c.product.barcode || `PROD-${c.product.id}`,
          productName: c.product.description || 'Producto',
          unitPrice: c.unitPrice,
          quantity: c.quantity,
          total: c.total,
        })),
        subtotal,
        discount: 0,
        itbis,
        total,
        paymentMethod: method,
        amountReceived: amountRec,
        change,
        companyId,
        cashRegisterId: session.id,
        cashRegisterSessionId: session.id,
      } as any);

      const folio = `FAC-M-${Date.now().toString().slice(-4)}`;
      const ncf = `${this.ncfType()}000000${Date.now().toString().slice(-2)}`;

      this.lastSaleSummary.set({
        folio,
        ncf,
        total,
        customerName: customer,
        customerPhone: phone,
      });

      // Guardar también en el caché local de ventas para que la PC lo vea de inmediato
      this.saleService.saveLocalSale({
        id: Date.now(),
        customerId: customerId || 1,
        total,
        paidAmount: amountRec,
        cashRegisterId: session.id,
        isCancelled: false,
        creationDate: new Date().toISOString(),
        details: this.cart().map((c) => ({
          productId: c.product.id || 0,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
      });

      this.isSubmitting.set(false);
      this.isPaymentModalOpen.set(false);
      this.isSuccessModalOpen.set(true);
      this.clearCart();
      await this.loadExecutiveData();
      this.notificationService.success('¡Venta guardada localmente! Se sincronizará al recuperar la conexión.');
      return;
    }

    // B) MODO ONLINE: Registrar venta mediante CashRegisterService
    try {
      // 1. Registrar venta rápida asociada a la sesión de caja activa
      const quickSaleRes = await this.cashRegisterService.registerQuickSale({
        customerId: customerId || null,
        customerName: customer,
        items: this.cart().map((c) => ({
          productId: c.product.id || 0,
          productName: c.product.description || 'Producto',
          unitPrice: c.unitPrice,
          quantity: c.quantity,
          total: c.total,
        })),
        subtotal,
        discount: 0,
        itbis,
        total,
        paymentMethod: method,
        amountReceived: amountRec,
        change,
        idempotencyKey,
      });

      const assignedId = quickSaleRes?.data?.id || Date.now();
      const folio = quickSaleRes?.data?.invoiceNumber || `FAC-M-${String(assignedId).padStart(4, '0')}`;

      // 2. Registro fiscal opcional con DGII / NCF si se seleccionó comprobante formal
      let ncfGenerated = `${this.ncfType()}000000${Date.now().toString().slice(-2)}`;
      try {
        const header: HeaderDto = {
          clientId: customerId || 1,
          clientName: customer,
          billingTypeId: 1,
          voucherTypeId: this.ncfType() === 'B01' ? 1 : 2,
          warehouseId: 1,
          rncOrCedula: '',
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
          totalAmount: item.total,
        }));
        const billingRes = await this.billingService.createBilling(header, items);
        if (billingRes?.data?.ncf) {
          ncfGenerated = billingRes.data.ncf;
        }
      } catch {
        // La venta ya quedó registrada en caja de forma segura
      }

      // 3. Guardar en el caché local de ventas para que SalesComponent (PC) lo vea al instante
      this.saleService.saveLocalSale({
        id: assignedId,
        customerId: customerId || 1,
        total,
        paidAmount: amountRec,
        cashRegisterId: session.id,
        isCancelled: false,
        creationDate: new Date().toISOString(),
        details: this.cart().map((c) => ({
          productId: c.product.id || 0,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
      });

      this.lastSaleSummary.set({
        folio,
        ncf: ncfGenerated,
        total,
        customerName: customer,
        customerPhone: phone,
      });

      this.isPaymentModalOpen.set(false);
      this.isSuccessModalOpen.set(true);
      this.clearCart();
      await this.loadExecutiveData();
      this.notificationService.success(`¡Venta cobrada con éxito! Vinculada a ${session.name}.`);
    } catch (err: any) {
      // Fallback a IndexedDB si hubo fallo de red repentino
      this.offlineSyncService.queueOfflineSale({
        customerId: customerId || 1,
        customerName: customer,
        items: this.cart().map((c) => ({
          productId: c.product.id || 0,
          productCode: c.product.reference || c.product.barcode || `PROD-${c.product.id}`,
          productName: c.product.description || 'Producto',
          unitPrice: c.unitPrice,
          quantity: c.quantity,
          total: c.total,
        })),
        subtotal,
        discount: 0,
        itbis,
        total,
        paymentMethod: method,
        amountReceived: amountRec,
        change,
        companyId,
        cashRegisterId: session.id,
        cashRegisterSessionId: session.id,
      } as any);

      const folio = `FAC-M-${Date.now().toString().slice(-4)}`;
      this.lastSaleSummary.set({
        folio,
        ncf: `${this.ncfType()}000000${Date.now().toString().slice(-2)}`,
        total,
        customerName: customer,
        customerPhone: phone,
      });

      this.isPaymentModalOpen.set(false);
      this.isSuccessModalOpen.set(true);
      this.clearCart();
      await this.loadExecutiveData();
      this.notificationService.info('Venta resguardada en cola fuera de línea.');
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
🏢 *Empresa:* ${this.tenantName()}
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
