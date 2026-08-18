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
  template: `
    <!-- Detail Modal -->
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div
          class="custom-modal-content modal-lg"
          (click)="$event.stopPropagation()"
        >
          <div class="custom-modal-header">
            <h5 class="fw-bold">{{ translationService.t('sales.modal.detailTitle') }}</h5>
            <button
              type="button"
              class="btn-close"
              (click)="close()"
              aria-label="Close"
            ></button>
          </div>
          <div class="custom-modal-body">
            @if (sale) {
              <div class="mb-4">
                <c-row>
                  <c-col md="6">
                    <div class="text-secondary small">{{ translationService.t('sales.table.saleId') }}</div>
                    <div class="fw-bold text-dark font-monospace">
                      #{{ sale.id }}
                    </div>
                    <div class="text-secondary small mt-2">{{ translationService.t('sales.table.date') }}</div>
                    <div class="text-dark">
                      {{ sale.creationDate | date: 'medium' }}
                    </div>
                  </c-col>
                  <c-col md="6" class="text-md-end mt-2 mt-md-0">
                    <div class="text-secondary small">{{ translationService.t('sales.table.status') }}</div>
                    <div>
                      <span
                        [ngClass]="
                          sale.isCancelled
                            ? 'badge bg-danger-subtle text-danger'
                            : 'badge bg-success-subtle text-success'
                        "
                      >
                        {{
                          sale.isCancelled
                            ? translationService.t('sales.filterCancelled')
                            : translationService.t('sales.filterProcessed')
                        }}
                      </span>
                    </div>
                  </c-col>
                </c-row>
              </div>

              <h6 class="fw-bold text-dark mb-2">{{ translationService.t('sales.modal.addProduct') }}</h6>
              <div class="table-responsive border rounded mb-3">
                <app-table
                  [columns]="[
                    { field: 'description', label: translationService.t('products.table.product') },
                    { field: 'quantity', label: translationService.t('sales.modal.quantity') },
                    { field: 'unitPrice', label: translationService.t('sales.modal.unitPrice') },
                    { field: 'subtotal', label: translationService.t('sales.modal.subtotal') },
                  ]"
                  [rows]="sale.details"
                  [rowTemplate]="saleDetailRowTpl"
                ></app-table>

                <ng-template #saleDetailRowTpl let-item>
                  <tr>
                    <td class="ps-3 fw-semibold text-dark">
                      {{ getProductName(item.productId) }}
                    </td>
                    <td class="text-end">{{ item.quantity }} u.</td>
                    <td class="text-end">
                      \${{ item.unitPrice | number: '1.2-2' }}
                    </td>
                    <td class="text-end pe-3 fw-bold">
                      \${{ item.quantity * item.unitPrice | number: '1.2-2' }}
                    </td>
                  </tr>
                </ng-template>

                <div class="table-footer mt-2">
                  <div class="text-end fw-bold">
                    {{ translationService.t('sales.modal.grandTotal') }}:
                    <span class="fw-bold text-dark font-size-md"
                      >\${{ sale.total | number: '1.2-2' }}</span
                    >
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="custom-modal-footer">
            <button cButton color="light" class="border" (click)="close()">
              {{ translationService.t('common.close') }}
            </button>
            @if (
              sale &&
              !sale.isCancelled &&
              authService.hasRole(['Admin', 'Manager'])
            ) {
              <button
                cButton
                color="danger"
                class="text-white border-0"
                (click)="openCancelModal()"
              >
                {{ translationService.t('sales.filterCancelled') }}
              </button>
            }
          </div>
        </div>
      </div>
    }

    <!-- Cancel Void Dialog -->
    @if (isCancelModalOpen) {
      <div
        class="custom-modal-backdrop"
        (click)="closeCancelModal()"
        style="z-index: 1060;"
      >
        <div class="custom-modal-content" (click)="$event.stopPropagation()">
          <div class="custom-modal-header">
            <h5 class="fw-bold">Void/Cancel Sale</h5>
            <button
              type="button"
              class="btn-close"
              (click)="closeCancelModal()"
              aria-label="Close"
            ></button>
          </div>
          <div class="custom-modal-body">
            <p class="text-body-secondary small mb-3">
              Are you sure you want to cancel this invoice? This transaction is
              irreversible and will refund stock items count back to inventory.
            </p>
            <form cForm [formGroup]="cancelForm">
              <div class="mb-3">
                <label class="small fw-semibold text-secondary mb-1"
                  >Reason for cancellation *</label
                >
                <input
                  formControlName="reason"
                  cFormControl
                  placeholder="e.g. Return of goods / input error"
                />
                @if (
                  cancelForm.get('reason')?.touched &&
                  cancelForm.get('reason')?.invalid
                ) {
                  <div class="text-danger small mt-1">
                    Cancellation reason is required (Max 250 chars).
                  </div>
                }
              </div>
            </form>
          </div>
          <div class="custom-modal-footer">
            <button
              cButton
              color="light"
              class="border"
              (click)="closeCancelModal()"
            >
              Dismiss
            </button>
            <button
              cButton
              color="danger"
              class="text-white border-0"
              [disabled]="isLoading() || cancelForm.invalid"
              (click)="cancelSale()"
            >
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                Cancelling...
              } @else {
                Void Invoice
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SaleDetailModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() sale: SaleResponseDto | null = null;
  @Output() cancelled = new EventEmitter<void>();

  products = signal<ProductDto[]>([]);
  isCancelModalOpen = false;
  isLoading = signal<boolean>(false);

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

  ngOnInit() {
    this.loadProducts();
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
      this.notificationService.success('Sale cancelled successfully.');
      this.closeCancelModal();
      this.cancelled.emit();
      this.close();
    } catch (e: any) {
      this.notificationService.error(
        e?.response?.data?.message || e?.message || 'Error cancelling sale.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  getProductName(productId: number): string {
    const p = this.products().find((item) => item.id === productId);
    return p ? p.description || 'Unknown Product' : `Product #${productId}`;
  }
}
