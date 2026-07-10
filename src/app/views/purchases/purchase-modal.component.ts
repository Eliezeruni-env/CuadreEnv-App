import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { PurchaseService } from '../../services/purchase.service';
import { ProductService } from '../../services/product.service';
import { NotificationService } from '../../services/notification.service';
import type { PurchaseDto, ProductDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  ColComponent,
  FormControlDirective,
  FormDirective,
  RowComponent,
  SpinnerComponent,
  FormSelectDirective,
  TableDirective
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
    TableDirective,
    IconDirective
  ],
  template: `
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div class="custom-modal-content modal-lg" (click)="$event.stopPropagation()">
          <div class="custom-modal-header">
            <h5 class="fw-bold">{{ selectedPurchase ? 'Purchase Record Details' : 'Log Supplier Purchase' }}</h5>
            <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
          </div>
          
          <div class="custom-modal-body">
            @if (!selectedPurchase) {
              <!-- Create Mode -->
              <form cForm [formGroup]="purchaseForm">
                <div class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">Supplier ID (Optional)</label>
                  <input type="number" formControlName="supplierId" cFormControl placeholder="e.g. 5" />
                </div>

                <!-- Items Section -->
                <div class="mb-4 mt-2">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="fw-bold text-dark mb-0">Restock Items</h6>
                    <button type="button" cButton color="primary" size="sm" class="py-1" (click)="addItem()">
                      Add Item Row
                    </button>
                  </div>

                  <div class="border rounded bg-light p-2">
                    @if (items.length === 0) {
                      <div class="text-center py-3 text-secondary small">No items added. Click "Add Item Row".</div>
                    } @else {
                      <div formArrayName="items">
                        @for (item of items.controls; track $index; let idx = $index) {
                          <div [formGroupName]="idx" class="row g-2 mb-2 align-items-end">
                            <div class="col-md-5">
                              <label class="small text-secondary mb-1">Product *</label>
                              <select cSelect formControlName="productId">
                                <option value="" disabled selected>Select product...</option>
                                @for (p of products(); track p.id) {
                                  <option [value]="p.id">{{ p.description }}</option>
                                }
                              </select>
                            </div>
                            <div class="col-md-3">
                              <label class="small text-secondary mb-1">Qty *</label>
                              <input type="number" formControlName="quantity" cFormControl />
                            </div>
                            <div class="col-md-3">
                              <label class="small text-secondary mb-1">Unit Cost ($) *</label>
                              <input type="number" formControlName="costPrice" cFormControl />
                            </div>
                            <div class="col-md-1 text-center">
                              <button type="button" cButton color="danger" size="sm" variant="ghost" class="mb-1" (click)="removeItem(idx)">
                                <svg cIcon name="cilTrash"></svg>
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>

                <c-row class="border-top pt-3 mt-3 align-items-center">
                  <c-col class="text-end offset-md-6" md="6">
                    <div class="text-secondary small">Estimated Total Cost</div>
                    <h2 class="fw-bold text-dark mb-0">\${{ calculateTotal() | number:'1.2-2' }}</h2>
                  </c-col>
                </c-row>
              </form>
            } @else {
              <!-- Detail Mode -->
              <div class="mb-4">
                <c-row>
                  <c-col md="6">
                    <div class="text-secondary small">Purchase ID</div>
                    <div class="fw-bold text-dark font-monospace">#{{ selectedPurchase.id }}</div>
                    <div class="text-secondary small mt-2">Registration Date</div>
                    <div class="text-dark">{{ selectedPurchase.creationDate | date:'medium' }}</div>
                  </c-col>
                  <c-col md="6" class="text-md-end mt-2 mt-md-0">
                    <div class="text-secondary small">Supplier ID</div>
                    <div class="text-dark fw-semibold">{{ selectedPurchase.supplierId ? 'Supplier #' + selectedPurchase.supplierId : 'General Supplier' }}</div>
                  </c-col>
                </c-row>
              </div>

              <h6 class="fw-bold text-dark mb-2">Itemized Goods</h6>
              <div class="table-responsive border rounded mb-3">
                <table cTable align="middle" class="mb-0">
                  <thead class="table-light text-uppercase font-size-xs fw-bold">
                    <tr>
                      <th scope="col" class="ps-3">Product Description</th>
                      <th scope="col" class="text-end">Quantity</th>
                      <th scope="col" class="text-end">Unit Cost</th>
                      <th scope="col" class="text-end pe-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of selectedPurchase.details; track $index) {
                      <tr>
                        <td class="ps-3 fw-semibold text-dark">{{ getProductName(item.productId) }}</td>
                        <td class="text-end">{{ item.quantity }} units</td>
                        <td class="text-end">\${{ item.costPrice | number:'1.2-2' }}</td>
                        <td class="text-end pe-3 fw-bold">\${{ (item.quantity * item.costPrice) | number:'1.2-2' }}</td>
                      </tr>
                    }
                    <tr class="table-light">
                      <td colspan="3" class="text-end fw-bold">Total Supply Cost:</td>
                      <td class="text-end pe-3 fw-bold text-dark font-size-md">\${{ selectedPurchase.total | number:'1.2-2' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            }
          </div>

          <div class="custom-modal-footer">
            <button cButton color="light" class="border" (click)="close()">{{ selectedPurchase ? 'Close' : 'Cancel' }}</button>
            @if (!selectedPurchase) {
              <button cButton color="primary" [disabled]="isLoading() || purchaseForm.invalid || items.length === 0" (click)="savePurchase()">
                @if (isLoading()) {
                  <c-spinner size="sm" class="me-2"></c-spinner>
                  Processing...
                } @else {
                  Log Purchase
                }
              </button>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class PurchaseModalComponent implements OnInit {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  selectedPurchase: PurchaseDto | null = null;
  products = signal<ProductDto[]>([]);
  isLoading = signal<boolean>(false);

  purchaseForm: FormGroup;

  constructor(
    private purchaseService: PurchaseService,
    private productService: ProductService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.purchaseForm = this.fb.group({
      supplierId: [''],
      items: this.fb.array([])
    });
  }

  ngOnInit() {
    this.loadProducts();
  }

  get items(): FormArray {
    return this.purchaseForm.get('items') as FormArray;
  }

  addItem() {
    const itemGroup = this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      costPrice: [0, [Validators.required, Validators.min(0)]]
    });

    itemGroup.get('productId')?.valueChanges.subscribe(pId => {
      const prod = this.products().find(p => p.id === parseInt(pId || '', 10));
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
      return acc + (quantity * cost);
    }, 0);
  }

  async loadProducts() {
    try {
      const pRes = await this.productService.getPagedProducts(1, 100);
      if (pRes.success && pRes.data) {
        this.products.set(pRes.data.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  openCreate() {
    this.selectedPurchase = null;
    this.purchaseForm.reset({ supplierId: '' });
    this.items.clear();
    this.addItem();
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
      costPrice: i.costPrice
    }));

    try {
      const res = await this.purchaseService.createPurchase({
        supplierId: formVal.supplierId ? parseInt(formVal.supplierId, 10) : null,
        total,
        details
      });

      if (res.success) {
        this.notificationService.success('Purchase registered successfully!');
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Failed to create purchase.');
      }
    } catch (e: any) {
      this.notificationService.error(e?.response?.data?.message || e?.message || 'Error saving purchase.');
    } finally {
      this.isLoading.set(false);
    }
  }

  getProductName(productId: number): string {
    const p = this.products().find(item => item.id === productId);
    return p ? p.description || 'Unknown Product' : `Product #${productId}`;
  }
}
