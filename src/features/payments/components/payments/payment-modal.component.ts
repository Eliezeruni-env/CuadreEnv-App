import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PaymentService } from '../../services/payment.service';
import { SaleService } from '../../../sales/services/sale.service';
import { PurchaseService } from '../../../purchases/services/purchase.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { applyFieldErrorsToForm } from '../../../cuadreEnv/utils/api-error-mapper';
import type { PaymentDto, SaleResponseDto, PurchaseDto } from '../../../cuadreEnv/types/api';
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
  templateUrl: './payment-modal.component.html',
})
export class PaymentModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);
  private paymentService = inject(PaymentService);
  private saleService = inject(SaleService);
  private purchaseService = inject(PurchaseService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  paymentType = signal<'sale' | 'purchase'>('sale');
  sales = signal<SaleResponseDto[]>([]);
  purchases = signal<PurchaseDto[]>([]);
  isLoading = signal<boolean>(false);

  paymentForm: FormGroup;

  constructor() {
    this.paymentForm = this.fb.group({
      saleId: [''],
      purchaseId: [''],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      method: ['Efectivo', [Validators.required]],
      reference: ['']
    });

    // Autofill amount when saleId changes
    this.paymentForm.get('saleId')?.valueChanges.subscribe((id) => {
      if (id) {
        const found = this.sales().find((s) => s.id === Number(id));
        if (found) {
          this.paymentForm.patchValue({ amount: found.total }, { emitEvent: false });
        }
      }
    });

    // Autofill amount when purchaseId changes
    this.paymentForm.get('purchaseId')?.valueChanges.subscribe((id) => {
      if (id) {
        const found = this.purchases().find((p) => p.id === Number(id));
        if (found) {
          this.paymentForm.patchValue({ amount: found.total }, { emitEvent: false });
        }
      }
    });
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    try {
      const [saleRes, purchaseRes] = await Promise.all([
        this.saleService.getSales(),
        this.purchaseService.getPurchases(),
      ]);

      if (saleRes?.success && saleRes.data) {
        this.sales.set(saleRes.data);
      }
      if (purchaseRes?.success && purchaseRes.data) {
        this.purchases.set(purchaseRes.data);
      }
    } catch (e: any) {
      console.error('Failed to load pending sales/purchases:', e?.message || e);
    }
  }

  setPaymentType(type: 'sale' | 'purchase') {
    this.paymentType.set(type);
    if (type === 'sale') {
      this.paymentForm.patchValue({ purchaseId: '', amount: 0 });
    } else {
      this.paymentForm.patchValue({ saleId: '', amount: 0 });
    }
  }

  openCreate() {
    this.paymentType.set('sale');
    this.paymentForm.reset({
      saleId: '',
      purchaseId: '',
      amount: 0,
      method: 'Efectivo',
      reference: ''
    });
    this.loadData();
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
      saleId: this.paymentType() === 'sale' && formVal.saleId ? parseInt(formVal.saleId, 10) : null,
      purchaseId: this.paymentType() === 'purchase' && formVal.purchaseId ? parseInt(formVal.purchaseId, 10) : null,
      amount: Number(formVal.amount),
      method: formVal.method,
      reference: formVal.reference ? formVal.reference.trim() : null
    };

    try {
      const res = await this.paymentService.createPayment(payload);
      if (res.success) {
        this.notificationService.success('Pago registrado exitosamente.');
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Error al crear el pago.');
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
