import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PaymentService } from '../../services/payment.service';
import { SaleService } from '../../services/sale.service';
import { NotificationService } from '../../services/notification.service';
import type { PaymentDto, SaleResponseDto } from '../../models/api';
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
            <h5 class="fw-bold">Register Payment Entry</h5>
            <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
          </div>
          
          <div class="custom-modal-body">
            <form cForm [formGroup]="paymentForm">
              <c-row>
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">Sale Invoice ID</label>
                  <select cSelect formControlName="saleId">
                    <option value="">None (For purchase or direct)</option>
                    @for (s of sales(); track s.id) {
                      <option [value]="s.id">Sale #{{ s.id }} (\${{ s.total | number:'1.2-2' }} invoice)</option>
                    }
                  </select>
                </c-col>

                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">Purchase ID</label>
                  <input type="number" formControlName="purchaseId" cFormControl placeholder="e.g. 10 (Leave blank if Sale)" />
                </c-col>
              </c-row>

              <c-row>
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">Amount ($) *</label>
                  <input type="number" formControlName="amount" cFormControl />
                  @if (paymentForm.get('amount')?.touched && paymentForm.get('amount')?.invalid) {
                    <div class="text-danger small mt-1">Amount must be greater than 0.</div>
                  }
                </c-col>

                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">Payment Method *</label>
                  <select cSelect formControlName="method">
                    <option value="Cash">Cash</option>
                    <option value="Card">Credit/Debit Card</option>
                    <option value="Transfer">Bank Transfer</option>
                  </select>
                </c-col>
              </c-row>

              <div class="mb-3">
                <label class="small fw-semibold text-secondary mb-1">Reference / Note</label>
                <input formControlName="reference" cFormControl placeholder="e.g. CARD-1234, Check / Bank receipt" />
              </div>
            </form>
          </div>

          <div class="custom-modal-footer">
            <button cButton color="light" class="border" (click)="close()">Cancel</button>
            <button cButton color="primary" [disabled]="isLoading() || paymentForm.invalid" (click)="savePayment()">
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                Processing...
              } @else {
                Register Payment
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class PaymentModalComponent implements OnInit {
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
    } catch (e) {
      console.error(e);
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
        this.notificationService.success('Payment registered successfully!');
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Failed to register payment.');
      }
    } catch (e: any) {
      this.notificationService.error(e?.response?.data?.message || e?.message || 'Error saving payment.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
