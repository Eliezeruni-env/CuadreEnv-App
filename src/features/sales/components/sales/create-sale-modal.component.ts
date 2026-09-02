import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { ProductService } from '../../../products/services/product.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CashRegisterService } from '../../../cash-register/services/cash-register.service';
import { SaleService } from '../../services/sale.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import type { ProductDto, CustomerDto, CashRegisterDto } from '../../../cuadreEnv/types/api';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  ColComponent,
  FormControlDirective,
  FormDirective,
  RowComponent,
  SpinnerComponent,
  FormSelectDirective
} from '@coreui/angular';

@Component({
  selector: 'app-create-sale-modal',
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
    IconDirective
  ],
  template: `
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div class="custom-modal-content modal-lg" (click)="$event.stopPropagation()">
          <div class="custom-modal-header">
            <h5 class="fw-bold">{{ translationService.t('sales.modal.createTitle') }}</h5>
            <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
          </div>
          <div class="custom-modal-body">
            <form cForm [formGroup]="saleForm">
              <c-row>
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('sales.modal.selectCustomer') }}</label>
                  <select cSelect formControlName="customerId">
                    <option value="">General Public</option>
                    @for (c of customers(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </c-col>

                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('cashRegister.title') }}</label>
                  <select cSelect formControlName="cashRegisterId">
                    <option value="">{{ translationService.t('common.select') }}</option>
                    @for (r of registers(); track r.id) {
                      <option [value]="r.id">{{ r.name }}</option>
                    }
                  </select>
                </c-col>
              </c-row>

              <!-- Items Section -->
              <div class="mb-4 mt-2">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h6 class="fw-bold text-dark mb-0">{{ translationService.t('sales.modal.addProduct') }}</h6>
                  <button type="button" cButton color="primary" size="sm" class="py-1" (click)="addItem()">
                    {{ translationService.t('common.add') }}
                  </button>
                </div>

                <div class="border rounded bg-light p-2" style="max-height: 375px; overflow-y: auto; overflow-x: hidden;">
                  @if (items.length === 0) {
                    <div class="text-center py-3 text-secondary small">{{ translationService.t('common.noResults') }}</div>
                  } @else {
                    <div formArrayName="items">
                      @for (item of items.controls; track $index; let idx = $index) {
                        <div [formGroupName]="idx" class="row g-2 mb-2 align-items-end">
                          <div class="col-md-5">
                            <label class="small text-secondary mb-1">{{ translationService.t('products.table.product') }} *</label>
                            <select cSelect formControlName="productId">
                              <option value="" disabled selected>{{ translationService.t('common.select') }}</option>
                              @for (p of products(); track p.id) {
                                <option [value]="p.id">{{ p.description }}</option>
                              }
                            </select>
                          </div>
                          <div class="col-md-3">
                            <label class="small text-secondary mb-1">{{ translationService.t('sales.modal.quantity') }} *</label>
                            <input type="number" formControlName="quantity" cFormControl />
                          </div>
                          <div class="col-md-3">
                            <label class="small text-secondary mb-1">{{ translationService.t('sales.modal.unitPrice') }} *</label>
                            <input type="number" formControlName="unitPrice" cFormControl />
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
                <c-col md="6">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('sales.table.paid') }} *</label>
                  <input type="number" formControlName="paidAmount" cFormControl />
                </c-col>
                <c-col md="6" class="text-end">
                  <div class="text-secondary small">{{ translationService.t('sales.modal.grandTotal') }}</div>
                  <h2 class="fw-bold text-dark mb-0">\${{ calculateTotal() | number:'1.2-2' }}</h2>
                </c-col>
              </c-row>
            </form>
          </div>
          <div class="custom-modal-footer">
            <button cButton color="light" class="border" (click)="close()">{{ translationService.t('common.cancel') }}</button>
            <button cButton color="primary" [disabled]="isLoading() || saleForm.invalid || items.length === 0" (click)="saveSale()">
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                {{ translationService.t('common.loading') }}
              } @else {
                {{ translationService.t('sales.modal.saveSale') }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class CreateSaleModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  products = signal<ProductDto[]>([]);
  customers = signal<CustomerDto[]>([]);
  registers = signal<CashRegisterDto[]>([]);
  isLoading = signal<boolean>(false);

  saleForm: FormGroup;

  constructor(
    private productService: ProductService,
    private customerService: CustomerService,
    private registerService: CashRegisterService,
    private saleService: SaleService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.saleForm = this.fb.group({
      customerId: [''],
      cashRegisterId: [''],
      paidAmount: [0, [Validators.required, Validators.min(0)]],
      items: this.fb.array([])
    });
  }

  ngOnInit() {
    this.loadMetadata();
  }

  get items(): FormArray {
    return this.saleForm.get('items') as FormArray;
  }

  addItem() {
    const itemGroup = this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]]
    });

    itemGroup.get('productId')?.valueChanges.subscribe(pId => {
      const prod = this.products().find(p => p.id === parseInt(pId || '', 10));
      if (prod) {
        itemGroup.patchValue({ unitPrice: prod.cost * 1.3 });
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
      const price = ctrl.get('unitPrice')?.value || 0;
      return acc + (quantity * price);
    }, 0);
  }

  async loadMetadata() {
    try {
      const pRes = await this.productService.getPagedProducts(1, 100);
      if (pRes.success && pRes.data) {
        this.products.set(pRes.data.items || []);
      }

      const cRes = await this.customerService.getCustomers({
        pageNumber: 1,
        pageSize: 1000,
        PageNumber: 1,
        PageSize: 1000
      } as any);
      if (cRes.success && cRes.data) {
        this.customers.set(cRes.data);
      }

      const rRes = await this.registerService.getCashRegisters();
      if (rRes.success && rRes.data) {
        this.registers.set(rRes.data);
      }
    } catch (e: any) {
      console.error('Failed to load modal metadata:', e?.message || e);
    }
  }

  reset() {
    this.saleForm.reset({
      customerId: '',
      cashRegisterId: '',
      paidAmount: 0
    });
    this.items.clear();
    this.addItem();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async saveSale() {
    if (this.saleForm.invalid || this.items.length === 0) {
      this.saleForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const formVal = this.saleForm.value;
    const total = this.calculateTotal();

    const saleDetails = formVal.items.map((i: any) => ({
      productId: parseInt(i.productId, 10),
      quantity: i.quantity,
      unitPrice: i.unitPrice
    }));

    try {
      const res = await this.saleService.createSale({
        customerId: formVal.customerId ? parseInt(formVal.customerId, 10) : null,
        cashRegisterId: formVal.cashRegisterId ? parseInt(formVal.cashRegisterId, 10) : null,
        total,
        paidAmount: formVal.paidAmount,
        dueDate: null,
        details: saleDetails
      });

      if (res.success) {
        this.notificationService.success('Venta registrada exitosamente.');
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Error al crear la venta.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
