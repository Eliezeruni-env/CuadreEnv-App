import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { SaleService } from '../../services/sale.service';
import { ProductService } from '../../../products/services/product.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { SaleResponseDto, ProductDto } from '../../../cuadreEnv/types/api';
import {
  ButtonDirective,
  ColComponent,
  FormControlDirective,
  FormDirective,
  RowComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { TableComponent } from '../../../cuadreEnv/components/table/table.component';

export interface SaleDetailItemView {
  productId: number;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

@Component({
  selector: 'app-sale-detail-modal',
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
    TableComponent,
  ],
  templateUrl: './sale-detail-modal.component.html',
})
export class SaleDetailModalComponent implements OnInit, OnChanges {
  readonly translationService = inject(TranslationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() sale: SaleResponseDto | null = null;
  @Output() cancelled = new EventEmitter<void>();

  products = signal<ProductDto[]>([]);
  itemsList = signal<SaleDetailItemView[]>([]);
  isCancelModalOpen = false;
  isLoading = signal<boolean>(false);
  isLoadingDetails = signal<boolean>(false);

  cancelForm: FormGroup;

  constructor(
    private saleService: SaleService,
    private productService: ProductService,
    public authService: AuthService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
  ) {
    this.cancelForm = this.fb.group({
      reason: ['', [Validators.required, Validators.maxLength(250)]],
    });
  }

  async ngOnInit() {
    await this.loadProducts();
    if (this.visible && this.sale) {
      await this.ensureSaleDetails();
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes['visible'] && this.visible) ||
      (changes['sale'] && this.sale)
    ) {
      await this.ensureSaleDetails();
    }
  }

  async loadProducts() {
    try {
      const pRes = await this.productService.getPagedProducts(1, 200);
      if (pRes.success && pRes.data?.items) {
        this.products.set(pRes.data.items);
      } else {
        const searchRes = await this.productService.searchProducts('');
        if (searchRes.success && searchRes.data) {
          this.products.set(searchRes.data);
        }
      }
    } catch (e: any) {
      console.error('Failed to load modal products:', e?.message || e);
    }
  }

  async ensureSaleDetails() {
    if (!this.sale) {
      this.itemsList.set([]);
      return;
    }

    let rawDetails: any[] =
      this.sale.details ||
      (this.sale as any).items ||
      (this.sale as any).saleDetails ||
      (this.sale as any).productDetails ||
      [];

    // If details are empty and we have a sale id, fetch full sale from API/cache
    if ((!rawDetails || rawDetails.length === 0) && this.sale.id) {
      this.isLoadingDetails.set(true);
      try {
        const res = await this.saleService.getSale(this.sale.id);
        if (res?.success && res.data) {
          const freshSale = res.data;
          rawDetails =
            freshSale.details ||
            (freshSale as any).items ||
            (freshSale as any).saleDetails ||
            (freshSale as any).productDetails ||
            [];
          if (rawDetails && rawDetails.length > 0) {
            this.sale = { ...this.sale, details: rawDetails };
          }
        }
      } catch (e) {
        console.warn('Could not fetch sale details by id:', e);
      } finally {
        this.isLoadingDetails.set(false);
      }
    }

    // Map items to standard view items
    if (rawDetails && rawDetails.length > 0) {
      const mapped: SaleDetailItemView[] = rawDetails.map((item: any) => {
        const pId = item.productId || item.id || 0;
        const pName =
          item.productName ||
          item.description ||
          item.name ||
          this.getProductName(pId);
        const qty = Number(item.quantity ?? 1) || 1;
        const price = Number(item.unitPrice ?? item.price ?? 0) || 0;
        const sub = Number(item.subtotal ?? item.total ?? (qty * price)) || (qty * price);

        return {
          productId: pId,
          productName: pName,
          description: pName,
          quantity: qty,
          unitPrice: price,
          subtotal: sub,
        };
      });
      this.itemsList.set(mapped);
    } else if (this.sale.total && this.sale.total > 0) {
      // Fallback if backend returned summary sale without line details
      const fallbackItem: SaleDetailItemView = {
        productId: (this.sale as any).productId || 1,
        productName: (this.sale as any).notes || (this.sale as any).description || `Venta #${this.sale.id}`,
        description: (this.sale as any).notes || (this.sale as any).description || `Venta #${this.sale.id}`,
        quantity: 1,
        unitPrice: this.sale.total,
        subtotal: this.sale.total,
      };
      this.itemsList.set([fallbackItem]);
    } else {
      this.itemsList.set([]);
    }
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  openCancelModal() {
    this.cancelForm.reset({ reason: '' });
    this.isCancelModalOpen = true;
  }

  closeCancelModal() {
    this.isCancelModalOpen = false;
  }

  async cancelSale() {
    if (this.cancelForm.invalid || !this.sale) {
      this.cancelForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const reason = this.cancelForm.value.reason;

    try {
      await this.saleService.cancelSale(this.sale.id, reason);
      this.notificationService.success('Venta anulada/cancelada exitosamente.');
      this.closeCancelModal();
      this.cancelled.emit();
      this.close();
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  getProductName(productId: number): string {
    const p = this.products().find((item) => item.id === productId);
    return p ? p.description || p.barcode || 'Producto' : `Producto #${productId}`;
  }
}
