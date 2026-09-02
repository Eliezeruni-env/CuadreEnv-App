import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PaymentService } from '../../services/payment.service';
import { SaleService } from '../../../sales/services/sale.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { applyFieldErrorsToForm } from '../../../cuadreEnv/utils/api-error-mapper';
import type { PaymentDto, SaleResponseDto } from '../../../cuadreEnv/types/api';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
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
  selector: 'app-payment-modal',
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
    FormSelectDirective
  ],
  template: `
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div class="custom-modal-content" (click)="$event.stopPropagation()">
          <div class="custom-modal-header">
            <h5 class="fw-bold">{{ translationService.t('payments.modal.createTitle') }}</h5>
            <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
          </div>
          
          <div class="custom-modal-body">
            <form cForm [formGroup]="paymentForm">
              <c-row>
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('sales.table.saleId') }}</label>
                  <select cSelect formControlName="saleId">
                    <option value="">{{ translationService.t('common.select') }}</option>
                    @for (s of sales(); track s.id) {
                      <option [value]="s.id">#{{ s.id }} (\${{ s.total | number:'1.2-2' }})</option>
                    }
                  </select>
                </c-col>

                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('purchases.table.purchaseId') }}</label>
                  <input type="number" formControlName="purchaseId" cFormControl placeholder="ID" />
                </c-col>
              </c-row>

              <c-row>
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('payments.modal.amountLabel') }} *</label>
                  <input type="number" formControlName="amount" cFormControl />
                </c-col>

                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('payments.modal.methodLabel') }} *</label>
                  <select cSelect formControlName="method">
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Transfer">Bank Transfer</option>
                  </select>
                </c-col>
              </c-row>

              <div class="mb-3">
                <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('payments.modal.refLabel') }}</label>
                <input formControlName="reference" cFormControl [placeholder]="translationService.t('payments.modal.refLabel')" />
              </div>
            </form>
          </div>

          <div class="custom-modal-footer">
            <button cButton color="light" class="border" (click)="close()">{{ translationService.t('common.cancel') }}</button>
            <button cButton color="primary" [disabled]="isLoading() || paymentForm.invalid" (click)="savePayment()">
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                {{ translationService.t('common.loading') }}
              } @else {
                {{ translationService.t('payments.modal.saveBtn') }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class PaymentModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  sales = signal<SaleResponseDto[]>([]);
  isLoading = signal<boolean>(false);

  paymentForm: FormGroup;

  constructor(
    private paymentService: PaymentService,
    private saleService: SaleService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.paymentForm = this.fb.group({
      saleId: [''],
      purchaseId: [''],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      method: ['Cash', [Validators.required]],
      reference: ['']
    });
  }

  ngOnInit() {
    this.loadSales();
  }

  async loadSales() {
    try {
      const saleRes = await this.saleService.getSales();
      if (saleRes.success && saleRes.data) {
        this.sales.set(saleRes.data);
      }
    } catch (e: any) {
      console.error('Failed to load sales list:', e?.message || e);
    }
  }

  openCreate() {
    this.paymentForm.reset({
      saleId: '',
      purchaseId: '',
      amount: 0,
      method: 'Cash',
      reference: ''
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async savePayment() {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const formVal = this.paymentForm.value;

    const payload: PaymentDto = {
      saleId: formVal.saleId ? parseInt(formVal.saleId, 10) : null,
      purchaseId: formVal.purchaseId ? parseInt(formVal.purchaseId, 10) : null,
      amount: formVal.amount,
      method: formVal.method,
      reference: formVal.reference || null
    };

    try {
      const res = await this.paymentService.createPayment(payload);
      if (res.success) {
        this.notificationService.success('Pago registrado exitosamente.');
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Error al registrar pago.');
      }
    } catch (e: any) {
      const mapped = this.notificationService.showApiError(e);
      if (mapped.fieldErrors) {
        applyFieldErrorsToForm(this.paymentForm, mapped.fieldErrors);
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}

