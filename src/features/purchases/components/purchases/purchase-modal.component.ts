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
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
} from '@angular/forms';
import { PurchaseService } from '../../services/purchase.service';
import { ProductService } from '../../../products/services/product.service';
import { SupplierService } from '../../services/supplier.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import type { PurchaseDto, ProductDto } from '../../../cuadreEnv/types/api';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { IconDirective } from '@coreui/icons-angular';
import { TableComponent } from '../../../cuadreEnv/components/table/table.component';
import {
  ButtonDirective,
  ColComponent,
  FormControlDirective,
  FormDirective,
  RowComponent,
  SpinnerComponent,
  FormSelectDirective,
} from '@coreui/angular';

@Component({
  selector: 'app-purchase-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    RowComponent,
    ColComponent,
    SpinnerComponent,
    FormSelectDirective,
    IconDirective,
    TableComponent,
  ],
  templateUrl: './purchase-modal.component.html',
})
export class PurchaseModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);
  private readonly supplierService = inject(SupplierService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  selectedPurchase: PurchaseDto | null = null;
  products = signal<ProductDto[]>([]);
  suppliers = signal<any[]>([]);
  isLoading = signal<boolean>(false);

  purchaseForm: FormGroup;

  constructor(
    private purchaseService: PurchaseService,
    private productService: ProductService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
  ) {
    this.purchaseForm = this.fb.group({
      supplierId: [''],
      items: this.fb.array([]),
    });
  }

  ngOnInit() {
    this.loadProducts();
    this.loadSuppliers();
  }

  async loadSuppliers() {
    try {
      const res = await this.supplierService.getSuppliers();
      if (res?.success && res.data) {
        this.suppliers.set(res.data);
      } else {
        this.suppliers.set([]);
      }
    } catch {
      this.suppliers.set([]);
    }
  }

  get items(): FormArray {
    return this.purchaseForm.get('items') as FormArray;
  }

  addItem() {
    const itemGroup = this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      costPrice: [0, [Validators.required, Validators.min(0)]],
    });

    itemGroup.get('productId')?.valueChanges.subscribe((pId) => {
      const prod = this.products().find(
        (p) => p.id === parseInt(pId || '', 10),
      );
      if (prod) {
        itemGroup.patchValue({ costPrice: prod.cost });
      }
    });

    this.items.push(itemGroup);
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  calculateTotal(): number {
    return this.items.controls.reduce((acc, ctrl) => {
      const quantity = ctrl.get('quantity')?.value || 0;
      const cost = ctrl.get('costPrice')?.value || 0;
      return acc + quantity * cost;
    }, 0);
  }

  async loadProducts() {
    try {
      const pRes = await this.productService.getPagedProducts(1, 100);
      if (pRes.success && pRes.data) {
        this.products.set(pRes.data.items || []);
      }
    } catch (e: any) {
      console.error('Failed to load purchase products:', e?.message || e);
    }
  }

  async openCreate() {
    this.selectedPurchase = null;
    this.purchaseForm.reset({ supplierId: '' });
    this.items.clear();
    this.addItem();
    await this.loadSuppliers();
    this.visible = true;
    this.visibleChange.emit(true);
  }

  openDetail(purchase: PurchaseDto) {
    this.selectedPurchase = purchase;
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async savePurchase() {
    if (this.purchaseForm.invalid || this.items.length === 0) {
      this.purchaseForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const formVal = this.purchaseForm.value;
    const total = this.calculateTotal();

    const details = formVal.items.map((i: any) => ({
      productId: parseInt(i.productId, 10),
      quantity: i.quantity,
      costPrice: i.costPrice,
    }));

    try {
      const res = await this.purchaseService.createPurchase({
        supplierId: formVal.supplierId
          ? parseInt(formVal.supplierId, 10)
          : null,
        total,
        details,
      });

      if (res.success) {
        this.notificationService.success('Compra registrada exitosamente.');
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(
          res.message || 'Error al crear la compra.',
        );
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  getProductName(productId: number): string {
    const p = this.products().find((item) => item.id === productId);
    return p ? p.description || 'Unknown Product' : `Product #${productId}`;
  }
}
