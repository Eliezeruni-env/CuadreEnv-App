import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import type { WarehouseDto, ProductDto, MovementDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent,
  TableDirective,
  AlertComponent,
  SpinnerComponent,
  NavComponent,
  NavItemComponent,
  NavLinkDirective,
  TabContentRefDirective,
  FormSelectDirective
} from '@coreui/angular';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    TableDirective,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    IconDirective,
    AlertComponent,
    SpinnerComponent,
    NavComponent,
    NavItemComponent,
    NavLinkDirective,
    FormSelectDirective
  ]
})
export class InventoryComponent implements OnInit {
  activeTab = signal<string>('warehouses');
  
  warehouses = signal<WarehouseDto[]>([]);
  products = signal<ProductDto[]>([]);
  movements = signal<MovementDto[]>([]);
  lowStockItems = signal<ProductDto[]>([]);
  
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  warehouseForm: FormGroup;
  inboundForm: FormGroup;
  outboundForm: FormGroup;
  transferForm: FormGroup;

  constructor(
    private inventoryService: InventoryService,
    private productService: ProductService,
    private fb: FormBuilder,
    public authService: AuthService
  ) {
    this.warehouseForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]]
    });

    this.inboundForm = this.fb.group({
      productId: ['', [Validators.required]],
      warehouseId: ['', [Validators.required]],
      quantity: [0, [Validators.required, Validators.min(1)]]
    });

    this.outboundForm = this.fb.group({
      productId: ['', [Validators.required]],
      warehouseId: ['', [Validators.required]],
      quantity: [0, [Validators.required, Validators.min(1)]]
    });

    this.transferForm = this.fb.group({
      productId: ['', [Validators.required]],
      fromWarehouseId: ['', [Validators.required]],
      toWarehouseId: ['', [Validators.required]],
      quantity: [0, [Validators.required, Validators.min(1)]]
    }, { validators: this.differentWarehousesValidator });
  }

  differentWarehousesValidator(g: FormGroup) {
    const from = g.get('fromWarehouseId')?.value;
    const to = g.get('toWarehouseId')?.value;
    return from && to && from === to ? { sameWarehouse: true } : null;
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      // Load warehouses
      const whRes = await this.inventoryService.getWarehouses();
      if (whRes.success && whRes.data) {
        this.warehouses.set(whRes.data);
      }

      // Load products (all for dropdown selection)
      const pRes = await this.productService.getPagedProducts(1, 100);
      if (pRes.success && pRes.data) {
        this.products.set(pRes.data.items || []);
      }

      // Load movements logs
      const mRes = await this.inventoryService.getMovements();
      if (mRes.success && mRes.data) {
        this.movements.set(mRes.data);
      }

      // Load low stock alerts
      const lRes = await this.inventoryService.getLowStock();
      if (lRes.success && lRes.data) {
        this.lowStockItems.set(lRes.data);
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error loading inventory data.');
    } finally {
      this.isLoading.set(false);
    }
  }

  setTab(tabName: string) {
    this.activeTab.set(tabName);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  async createWarehouse() {
    if (this.warehouseForm.invalid) {
      this.warehouseForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    try {
      const name = this.warehouseForm.value.name;
      const res = await this.inventoryService.createWarehouse(name);
      if (res.success) {
        this.successMessage.set('Warehouse created successfully!');
        this.warehouseForm.reset();
        this.loadData();
      } else {
        this.errorMessage.set(res.message || 'Failed to create warehouse.');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error creating warehouse.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onInboundSubmit() {
    if (this.inboundForm.invalid) {
      this.inboundForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    try {
      const val = this.inboundForm.value;
      const res = await this.inventoryService.addStock({
        productId: parseInt(val.productId, 10),
        warehouseId: parseInt(val.warehouseId, 10),
        quantity: val.quantity
      });
      if (res.success) {
        this.successMessage.set('Stock added successfully!');
        this.inboundForm.reset({ quantity: 0 });
        this.loadData();
      } else {
        this.errorMessage.set(res.message || 'Failed to add stock.');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error executing stock transaction.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onOutboundSubmit() {
    if (this.outboundForm.invalid) {
      this.outboundForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    try {
      const val = this.outboundForm.value;
      const res = await this.inventoryService.removeStock({
        productId: parseInt(val.productId, 10),
        warehouseId: parseInt(val.warehouseId, 10),
        quantity: val.quantity
      });
      if (res.success) {
        this.successMessage.set('Stock removed successfully!');
        this.outboundForm.reset({ quantity: 0 });
        this.loadData();
      } else {
        this.errorMessage.set(res.message || 'Failed to remove stock.');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error executing stock transaction.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onTransferSubmit() {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    try {
      const val = this.transferForm.value;
      const res = await this.inventoryService.transferStock({
        productId: parseInt(val.productId, 10),
        fromWarehouseId: parseInt(val.fromWarehouseId, 10),
        toWarehouseId: parseInt(val.toWarehouseId, 10),
        quantity: val.quantity
      });
      if (res.success) {
        this.successMessage.set('Stock transferred successfully!');
        this.transferForm.reset({ quantity: 0 });
        this.loadData();
      } else {
        this.errorMessage.set(res.message || 'Failed to transfer stock.');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error executing stock transfer.');
    } finally {
      this.isLoading.set(false);
    }
  }

  getProductName(productId: number): string {
    const p = this.products().find(item => item.id === productId);
    return p ? p.description || 'Unknown Product' : `Product #${productId}`;
  }

  getWarehouseName(warehouseId?: number | null): string {
    if (!warehouseId) return '-';
    const w = this.warehouses().find(item => item.id === warehouseId);
    return w ? w.name : `Warehouse #${warehouseId}`;
  }
}
