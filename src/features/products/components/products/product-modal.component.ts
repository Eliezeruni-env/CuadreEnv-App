import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import type { ProductDto } from '../../../cuadreEnv/types/api';
import {
  ButtonDirective,
  ColComponent,
  FormControlDirective,
  FormDirective,
  RowComponent,
  SpinnerComponent
} from '@coreui/angular';

@Component({
  selector: 'app-product-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    RowComponent,
    ColComponent,
    SpinnerComponent
  ],
  template: `
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div class="custom-modal-content modal-lg" (click)="$event.stopPropagation()">
          <div class="custom-modal-header">
            <h5 class="fw-bold">{{ isEditMode ? translationService.t('products.modal.editTitle') : translationService.t('products.modal.createTitle') }}</h5>
            <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
          </div>
          <div class="custom-modal-body">
            <form cForm [formGroup]="productForm">
              <!-- Description -->
              <div class="mb-3">
                <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('products.modal.nameLabel') }} *</label>
                <input formControlName="description" cFormControl [placeholder]="translationService.t('products.modal.nameLabel')" />
                @if (productForm.get('description')?.touched && productForm.get('description')?.invalid) {
                  <div class="text-danger small mt-1">{{ translationService.t('common.error') }}</div>
                }
              </div>

              <c-row>
                <!-- Barcode -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('products.modal.barcodeLabel') }}</label>
                  <input formControlName="barcode" cFormControl [placeholder]="translationService.t('products.modal.barcodeLabel')" />
                </c-col>

                <!-- Reference -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('products.modal.refLabel') }}</label>
                  <input formControlName="reference" cFormControl [placeholder]="translationService.t('products.modal.refLabel')" />
                </c-col>
              </c-row>

              <c-row>
                <!-- Cost -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('products.modal.costLabel') }} *</label>
                  <input formControlName="cost" type="number" cFormControl />
                </c-col>

                <!-- Stock -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('products.modal.stockLabel') }} *</label>
                  <input formControlName="stock" type="number" cFormControl [readonly]="isEditMode" />
                </c-col>
              </c-row>

              <div class="mb-3">
                <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('common.description') }}</label>
                <input formControlName="shortDescription" cFormControl [placeholder]="translationService.t('common.description')" />
              </div>

              <c-row>
                <!-- Min Qty -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('products.modal.minStockLabel') }}</label>
                  <input formControlName="minimumQuantity" type="number" cFormControl />
                </c-col>

                <!-- Max Qty -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">Max Qty</label>
                  <input formControlName="maximumQuantity" type="number" cFormControl />
                </c-col>
              </c-row>

              <!-- Invoice Without Stock Checkbox -->
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="invoiceWithoutStock" formControlName="invoiceWithoutStock">
                <label class="form-check-label small fw-semibold text-secondary" for="invoiceWithoutStock">
                  Allow invoicing without stock
                </label>
              </div>
            </form>
          </div>
          <div class="custom-modal-footer">
            <button cButton color="light" class="border" (click)="close()">{{ translationService.t('products.modal.cancelBtn') }}</button>
            <button cButton color="primary" [disabled]="isLoading() || productForm.invalid" (click)="saveProduct()">
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                {{ translationService.t('common.loading') }}
              } @else {
                {{ translationService.t('products.modal.saveBtn') }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ProductModalComponent {
  readonly translationService = inject(TranslationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  isEditMode = false;
  selectedProductId: number | null = null;
  isLoading = signal<boolean>(false);

  productForm: FormGroup;

  constructor(
    private productService: ProductService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.productForm = this.fb.group({
      description: ['', [Validators.required, Validators.maxLength(250)]],
      barcode: [''],
      reference: [''],
      cost: [0, [Validators.required, Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      shortDescription: [''],
      minimumQuantity: [0],
      maximumQuantity: [0],
      invoiceWithoutStock: [false]
    });
  }

  openCreate() {
    this.isEditMode = false;
    this.selectedProductId = null;
    this.productForm.reset({
      description: '',
      barcode: '',
      reference: '',
      cost: 0,
      stock: 0,
      shortDescription: '',
      minimumQuantity: 0,
      maximumQuantity: 0,
      invoiceWithoutStock: false
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  openEdit(product: ProductDto) {
    this.isEditMode = true;
    this.selectedProductId = product.id || null;
    this.productForm.patchValue({
      description: product.description || '',
      barcode: product.barcode || '',
      reference: product.reference || '',
      cost: product.cost || 0,
      stock: product.stock || 0,
      shortDescription: product.shortDescription || '',
      minimumQuantity: product.minimumQuantity || 0,
      maximumQuantity: product.maximumQuantity || 0,
      invoiceWithoutStock: product.invoiceWithoutStock || false
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async saveProduct() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const formVal = this.productForm.value;

    const payload: ProductDto = {
      description: formVal.description,
      barcode: formVal.barcode || null,
      reference: formVal.reference || null,
      cost: formVal.cost,
      stock: formVal.stock,
      shortDescription: formVal.shortDescription || null,
      minimumQuantity: formVal.minimumQuantity || 0,
      maximumQuantity: formVal.maximumQuantity || 0,
      invoiceWithoutStock: formVal.invoiceWithoutStock || false
    };

    try {
      if (this.isEditMode) {
        payload.id = this.selectedProductId!;
        await this.productService.updateProduct(payload);
        this.notificationService.success('Product updated successfully!');
      } else {
        await this.productService.createProduct(payload);
        this.notificationService.success('Product created successfully!');
      }
      this.saved.emit();
      this.close();
    } catch (e: any) {
      this.notificationService.error(e?.response?.data?.message || e?.message || 'Error saving product.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
