import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../products/services/product.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { UserService } from '../../../users/services/user.service';
import { SaleService } from '../../../sales/services/sale.service';
import { CashRegisterService } from '../../../cash-register/services/cash-register.service';
import { AccountReceivableService } from '../../../payments/services/account-receivable.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import type {
  MovementDto,
  ProductDto,
  WarehouseDto,
} from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import {
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  RowComponent,
  SpinnerComponent,
  AlertComponent,
  ButtonDirective,
  FormModule,
} from '@coreui/angular';

@Component({
  templateUrl: 'dashboard.component.html',
  styleUrls: ['dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    IconDirective,
    SpinnerComponent,
    AlertComponent,
    ButtonDirective,
    FormModule,
    RouterLink,
  ],
})
export class DashboardComponent implements OnInit {
  private productService = inject(ProductService);
  private inventoryService = inject(InventoryService);
  private userService = inject(UserService);
  private saleService = inject(SaleService);
  private cashRegisterService = inject(CashRegisterService);
  private accountReceivableService = inject(AccountReceivableService);
  public authService = inject(AuthService);
  public translationService = inject(TranslationService);

  // Date Filter Signals
  startDate = signal<string>('');
  endDate = signal<string>('');
  selectedPreset = signal<string>('all');

  // Stats Counters & Key KPIs
  productsCount = signal<number>(0);
  warehousesCount = signal<number>(0);
  usersCount = signal<number>(0);
  lowStockCount = signal<number>(0);
  todaySalesTotal = signal<number>(0);
  todaySalesCount = signal<number>(0);
  activeCashRegistersCount = signal<number>(0);
  overdueAccountsCount = signal<number>(0);

  // Detailed lists
  recentMovements = signal<MovementDto[]>([]);
  auditMovements = signal<MovementDto[]>([]);
  productsList = signal<ProductDto[]>([]);
  warehousesList = signal<WarehouseDto[]>([]);
  lowStockProducts = signal<ProductDto[]>([]);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  setPreset(preset: 'today' | '7days' | 'thisMonth' | 'all') {
    this.selectedPreset.set(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      this.startDate.set(todayStr);
      this.endDate.set(todayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      this.startDate.set(past.toISOString().split('T')[0]);
      this.endDate.set(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      this.startDate.set(firstDay.toISOString().split('T')[0]);
      this.endDate.set(todayStr);
    } else if (preset === 'all') {
      this.startDate.set('');
      this.endDate.set('');
    }

    this.loadDashboardData();
  }

  onDateChange() {
    this.selectedPreset.set('custom');
    this.loadDashboardData();
  }

  async loadDashboardData() {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const from = this.startDate();
    const to = this.endDate();

    try {
      // 1. Fetch Sales & apply Date Range filter
      const salesRes = await this.saleService.getSales();
      if (salesRes.success && salesRes.data) {
        let filteredSales = salesRes.data.filter((s: any) => !s.isCancelled);
        if (from) {
          filteredSales = filteredSales.filter((s: any) => {
            const sDate = s.createdAt ? s.createdAt.split('T')[0] : '';
            return sDate >= from;
          });
        }
        if (to) {
          filteredSales = filteredSales.filter((s: any) => {
            const sDate = s.createdAt ? s.createdAt.split('T')[0] : '';
            return sDate <= to;
          });
        }

        const totalAmount = filteredSales.reduce(
          (acc: number, s: any) => acc + (s.totalAmount || s.total || 0),
          0,
        );
        this.todaySalesTotal.set(totalAmount);
        this.todaySalesCount.set(filteredSales.length);
      }

      // 2. Fetch Active Cash Registers KPI
      const cashRes = await this.cashRegisterService.getCashRegisters();
      if (cashRes.success && cashRes.data) {
        const activeCount = cashRes.data.filter(
          (c: any) => c.isOpen === true || c.status === 'Open' || c.status === 'Opened',
        ).length;
        this.activeCashRegistersCount.set(activeCount);
      }

      // 3. Fetch Low Stock Alerts KPI
      const lowStockRes = await this.inventoryService.getLowStock();
      if (lowStockRes.success && lowStockRes.data) {
        this.lowStockCount.set(lowStockRes.data.length);
        this.lowStockProducts.set(lowStockRes.data);
      }

      // 4. Fetch Overdue Accounts Receivable KPI
      const overdueRes = await this.accountReceivableService.getOverdue();
      if (overdueRes.success && overdueRes.data) {
        this.overdueAccountsCount.set(overdueRes.data.length);
      }

      // 5. Fetch general counts (Products, Warehouses, Users)
      const productsRes = await this.productService.getPagedProducts(1, 1);
      if (productsRes.success && productsRes.data) {
        this.productsCount.set(productsRes.data.total || 0);
      }

      const warehousesRes = await this.inventoryService.getWarehouses();
      if (warehousesRes.success && warehousesRes.data) {
        this.warehousesCount.set(warehousesRes.data.length);
        this.warehousesList.set(warehousesRes.data);
      }

      const usersRes = await this.userService.getUsers();
      if (usersRes.success && usersRes.data) {
        this.usersCount.set(usersRes.data.length);
      }

      // 6. Fetch audit movements feed (Historial de Auditoría)
      const auditRes = await this.inventoryService.getAuditMovements();
      if (auditRes.success && auditRes.data) {
        let filteredAudit = auditRes.data;
        if (from) {
          filteredAudit = filteredAudit.filter((m: any) => {
            const mDate = m.timestamp || m.createdAt || m.occurredAt || m.creationDate ? (m.timestamp || m.createdAt || m.occurredAt || m.creationDate).split('T')[0] : '';
            return mDate === '' || mDate >= from;
          });
        }
        if (to) {
          filteredAudit = filteredAudit.filter((m: any) => {
            const mDate = m.timestamp || m.createdAt || m.occurredAt || m.creationDate ? (m.timestamp || m.createdAt || m.occurredAt || m.creationDate).split('T')[0] : '';
            return mDate === '' || mDate <= to;
          });
        }
        this.auditMovements.set(filteredAudit.slice(0, 10));
      }

      // 7. Fetch inventory movements with date filter
      const movementsRes = await this.inventoryService.getMovements({
        from: from || undefined,
        to: to || undefined,
      });
      if (movementsRes.success && movementsRes.data) {
        this.recentMovements.set(movementsRes.data.slice(0, 8));
      }

      // 8. Fetch products catalog for name resolutions
      const pRes = await this.productService.getPagedProducts(1, 100);
      if (pRes.success && pRes.data) {
        this.productsList.set(pRes.data.items || []);
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message ||
          e?.message ||
          'Error loading dashboard metrics.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  getProductName(productId: number): string {
    const p = this.productsList().find((item) => item.id === productId);
    return p ? p.description || 'Producto' : `Producto #${productId}`;
  }

  getWarehouseName(warehouseId?: number | null): string {
    if (!warehouseId) return '-';
    const w = this.warehousesList().find((item) => item.id === warehouseId);
    return w ? w.name : `Almacén #${warehouseId}`;
  }

  getDaysAgoMock(index: number): string {
    if (index === 0) return 'Hace un momento';
    if (index === 1) return 'Hace 10 min';
    if (index === 2) return 'Hace 1 hora';
    if (index === 3) return 'Hace 3 horas';
    return `Hace ${index} horas`;
  }
}
