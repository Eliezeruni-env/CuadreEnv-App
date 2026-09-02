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
  templateUrl: './payment-modal.component.html',
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
