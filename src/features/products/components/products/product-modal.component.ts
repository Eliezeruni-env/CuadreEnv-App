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
  templateUrl: './product-modal.component.html',
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

          const inputEl = document.querySelector('input[formControlName="description"]') as HTMLInputElement;
          if (inputEl) {
            inputEl.focus();
          }
          this.isLoading.set(false);
          return;
        }

        const barcode = String(formVal.barcode || '').trim();
        if (barcode && existing.some(p => (p.barcode || '').trim() === barcode)) {
          this.notificationService.error('El código de barras ya está registrado en otro producto.');
          this.productForm.get('barcode')?.setErrors({ duplicate: true });
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
