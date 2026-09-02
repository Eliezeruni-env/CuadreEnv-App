import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { ProductTypeService } from '../../services/product-type.service';
import { CategoryService } from '../../services/category.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { ConfirmDialogService } from '../../../cuadreEnv/services/confirm-dialog.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { applyFieldErrorsToForm } from '../../../cuadreEnv/utils/api-error-mapper';
import {
  PRODUCT_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
  type ProductDto,
} from '../../../cuadreEnv/types/api';
import {
  ButtonDirective,
  ColComponent,
  FormControlDirective,
  FormDirective,
  RowComponent,
  SpinnerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

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
    SpinnerComponent,
    IconDirective
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
                  @if (productForm.get('description')?.hasError('duplicate')) {
                    <div class="text-danger small mt-1">El nombre del producto ya existe.</div>
                  } @else {
                    <div class="text-danger small mt-1">{{ translationService.t('common.error') }}</div>
                  }
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
                <!-- Product Type Dropdown -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">
                    Tipo de Producto @if (isRealBackendTypes()) { * }
                  </label>
                  <select formControlName="productTypeId" class="form-select">
                    <option [ngValue]="null">-- Seleccionar Tipo --</option>
                    @for (pt of productTypes(); track pt.id) {
                      <option [ngValue]="pt.id">{{ pt.name || pt.description || ('Tipo #' + pt.id) }}</option>
                    }
                  </select>
                  @if (isRealBackendTypes() && productForm.get('productTypeId')?.touched && productForm.get('productTypeId')?.invalid) {
                    <div class="text-danger small mt-1">El tipo de producto es requerido.</div>
                  }
                </c-col>

                <!-- Category Dropdown -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">
                    Categoría @if (isRealBackendCategories()) { * }
                  </label>
                  <select formControlName="categoryId" class="form-select">
                    <option [ngValue]="null">-- Seleccionar Categoría --</option>
                    @for (cat of categories(); track cat.id) {
                      <option [ngValue]="cat.id">{{ cat.name || cat.description || ('Categoría #' + cat.id) }}</option>
                    }
                  </select>
                  @if (isRealBackendCategories() && productForm.get('categoryId')?.touched && productForm.get('categoryId')?.invalid) {
                    <div class="text-danger small mt-1">La categoría es requerida.</div>
                  }
                  @if (!isRealBackendCategories()) {
                    <span class="text-body-secondary font-size-xs mt-1 d-block">
                      Categoría opcional (no se enviará al backend hasta que existan categorías en la base de datos)
                    </span>
                  }
                </c-col>
              </c-row>

              <c-row>
                <!-- Cost -->
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('products.modal.costLabel') }} *</label>
                  <input formControlName="cost" type="number" cFormControl />
                  @if (productForm.get('cost')?.touched && productForm.get('cost')?.invalid) {
                    <div class="text-danger small mt-1">El costo debe ser mayor a cero.</div>
                  }
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
          <div class="custom-modal-footer d-flex justify-content-between">
            <div>
              @if (isEditMode) {
                <button cButton color="danger" class="text-white" [disabled]="isLoading()" (click)="deleteProduct()">
                  <svg cIcon name="cilTrash" class="me-1"></svg>
                  Eliminar
                </button>
              }
            </div>
            <div class="d-flex gap-2">
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
      </div>
    }
  `
})
export class ProductModalComponent {
  readonly translationService = inject(TranslationService);
  private productService = inject(ProductService);
  private productTypeService = inject(ProductTypeService);
  private categoryService = inject(CategoryService);
  private notificationService = inject(NotificationService);
  private confirmService = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  isEditMode = false;
  selectedProductId: number | null = null;
  isLoading = signal<boolean>(false);

  productTypes = signal<any[]>([]);
  categories = signal<any[]>([]);

  isRealBackendTypes = signal<boolean>(false);
  isRealBackendCategories = signal<boolean>(false);

  productForm: FormGroup;

  constructor() {
    this.productForm = this.fb.group({
      description: ['', [Validators.required, Validators.maxLength(200)]],
      barcode: ['', [Validators.maxLength(100)]],
      reference: ['', [Validators.maxLength(50)]],
      productTypeId: [null],
      categoryId: [null],
      cost: [0, [Validators.required, Validators.min(0.01)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      shortDescription: ['', [Validators.maxLength(200)]],
      minimumQuantity: [0, [Validators.min(0)]],
      maximumQuantity: [0, [Validators.min(0)]],
      invoiceWithoutStock: [false]
    });
  }

  async loadLookups() {
    this.isRealBackendTypes.set(false);
    this.isRealBackendCategories.set(false);

    // 1. Product Types
    try {
      const typesRes = await this.productTypeService.getProductTypes();
      const typeItems = Array.isArray(typesRes?.data) ? typesRes.data : [];
      if (typesRes?.success && typeItems.length > 0) {
        this.isRealBackendTypes.set(true);
        this.productTypes.set(typeItems);
        this.productForm.get('productTypeId')?.setValidators([Validators.required]);
      } else {
        this.isRealBackendTypes.set(false);
        this.productTypes.set(PRODUCT_TYPE_OPTIONS);
        this.productForm.get('productTypeId')?.clearValidators();
      }
    } catch {
      this.isRealBackendTypes.set(false);
      this.productTypes.set(PRODUCT_TYPE_OPTIONS);
      this.productForm.get('productTypeId')?.clearValidators();
    }
    this.productForm.get('productTypeId')?.updateValueAndValidity();

    // 2. Categories
    try {
      const catsRes = await this.categoryService.getCategories();
      const catItems = Array.isArray(catsRes?.data) ? catsRes.data : [];
      if (catsRes?.success && catItems.length > 0) {
        this.isRealBackendCategories.set(true);
        this.categories.set(catItems);
        this.productForm.get('categoryId')?.setValidators([Validators.required]);
      } else {
        this.isRealBackendCategories.set(false);
        this.categories.set(CATEGORY_OPTIONS);
        this.productForm.get('categoryId')?.clearValidators();
      }
    } catch {
      this.isRealBackendCategories.set(false);
      this.categories.set(CATEGORY_OPTIONS);
      this.productForm.get('categoryId')?.clearValidators();
    }
    this.productForm.get('categoryId')?.updateValueAndValidity();
  }

  async openCreate() {
    this.isEditMode = false;
    this.selectedProductId = null;
    await this.loadLookups();
    this.productForm.reset({
      description: '',
      barcode: '',
      reference: '',
      productTypeId: null,
      categoryId: null,
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

  async openEdit(product: ProductDto) {
    this.isEditMode = true;
    this.selectedProductId = product.id || null;
    await this.loadLookups();
    this.productForm.patchValue({
      description: product.description || '',
      barcode: product.barcode || '',
      reference: product.reference || '',
      productTypeId: product.productTypeId || null,
      categoryId: product.categoryId || null,
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
    const name = String(formVal.description || '').trim();

    // pre-flight duplicate check
    if (!this.isEditMode) {
      try {
        const searchRes = await this.productService.searchProducts(name);
        const existing = searchRes?.data || [];
        if (existing && existing.some(p => (p.description || '').toLowerCase() === name.toLowerCase())) {
          this.notificationService.error('El nombre del producto ya existe.');
          this.productForm.get('description')?.setErrors({ duplicate: true });

          // Focus the name field
          const inputEl = document.querySelector('input[formControlName="description"]') as HTMLInputElement;
          if (inputEl) {
            inputEl.focus();
          }
          this.isLoading.set(false);
          return;
        }
      } catch (err) {
        console.warn('Error doing pre-flight check:', err);
      }
    }

    const payload: ProductDto = {
      description: name,
      cost: Number(formVal.cost) || 0,
      stock: Number(formVal.stock) || 0,
      invoiceWithoutStock: Boolean(formVal.invoiceWithoutStock),
      barcode: String(formVal.barcode || '').trim(),
      reference: String(formVal.reference || '').trim(),
      shortDescription: String(formVal.shortDescription || '').trim(),
      minimumQuantity: Number(formVal.minimumQuantity) || 0,
      maximumQuantity: Number(formVal.maximumQuantity) || 0,
      unitOfMeasurementId: 1,
      companyId: this.authService.companyId() || 0
    };

    if (this.isRealBackendTypes() && formVal.productTypeId) {
      payload.productTypeId = Number(formVal.productTypeId);
    }
    if (this.isRealBackendCategories() && formVal.categoryId) {
      payload.categoryId = Number(formVal.categoryId);
    }

    try {
      if (this.isEditMode) {
        payload.id = this.selectedProductId!;
        await this.productService.updateProduct(payload);
        this.notificationService.success('Producto actualizado exitosamente.');
      } else {
        await this.productService.createProduct(payload);
        this.notificationService.success('Producto creado exitosamente.');
      }
      this.saved.emit();
      this.close();
    } catch (e: any) {
      const mapped = this.notificationService.showApiError(e);
      if (mapped.fieldErrors) {
        applyFieldErrorsToForm(this.productForm, mapped.fieldErrors);
      }
      if (mapped.errorCode === 'DUPLICATE_NAME') {
        this.productForm.get('description')?.setErrors({ duplicate: true });
        const inputEl = document.querySelector('input[formControlName="description"]') as HTMLInputElement;
        if (inputEl) {
          inputEl.focus();
        }
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteProduct() {
    if (!this.selectedProductId) return;
    const productName = this.productForm.get('description')?.value || `Producto #${this.selectedProductId}`;
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar producto?',
      message: '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.',
      itemName: productName,
      itemType: 'Producto',
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (!confirmed) return;

    this.isLoading.set(true);
    try {
      await this.productService.deleteProduct(this.selectedProductId);
      this.notificationService.success('Producto eliminado exitosamente.');
      this.saved.emit();
      this.close();
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
