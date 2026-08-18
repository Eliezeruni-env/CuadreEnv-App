import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../products/services/product.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { UserService } from '../../../users/services/user.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import type {
  MovementDto,
  ProductDto,
  WarehouseDto,
  UserDto,
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
} from '@coreui/angular';

@Component({
  templateUrl: 'dashboard.component.html',
  styleUrls: ['dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    IconDirective,
    SpinnerComponent,
    AlertComponent,
    ButtonDirective,
    RouterLink,
  ],
})
export class DashboardComponent implements OnInit {
  private productService = inject(ProductService);
  private inventoryService = inject(InventoryService);
  private userService = inject(UserService);
  public authService = inject(AuthService);
  public translationService = inject(TranslationService);

  // Stats Counters
  productsCount = signal<number>(0);
  warehousesCount = signal<number>(0);
  usersCount = signal<number>(0);
  lowStockCount = signal<number>(0);

  // Recent Activity Timeline
  recentMovements = signal<MovementDto[]>([]);
  productsList = signal<ProductDto[]>([]);
  warehousesList = signal<WarehouseDto[]>([]);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData() {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      // 1. Fetch counts
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

      const lowStockRes = await this.inventoryService.getLowStock();
      if (lowStockRes.success && lowStockRes.data) {
        this.lowStockCount.set(lowStockRes.data.length);
      }

      // 2. Fetch recent movements for activity timeline
      const movementsRes = await this.inventoryService.getMovements();
      if (movementsRes.success && movementsRes.data) {
        // Take top 8 recent movements
        this.recentMovements.set(movementsRes.data.slice(0, 8));
      }

      // 3. Fetch products mapping list for names display
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
    return p ? p.description || 'Unknown Product' : `Product #${productId}`;
  }

  getWarehouseName(warehouseId?: number | null): string {
    if (!warehouseId) return '-';
    const w = this.warehousesList().find((item) => item.id === warehouseId);
    return w ? w.name : `Warehouse #${warehouseId}`;
  }

  getDaysAgoMock(index: number): string {
    if (index === 0) return 'Just now';
    if (index === 1) return '10 minutes ago';
    if (index === 2) return '1 hour ago';
    if (index === 3) return '3 hours ago';
    return `${index} hours ago`;
  }
}
