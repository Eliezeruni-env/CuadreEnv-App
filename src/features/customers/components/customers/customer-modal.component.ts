import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import type { CustomerDto } from '../../../cuadreEnv/types/api';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  RowComponent,
  ColComponent,
  SpinnerComponent
} from '@coreui/angular';

@Component({
  selector: 'app-customer-modal',
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
        <div class="custom-modal-content" (click)="$event.stopPropagation()">
          <div class="custom-modal-header">
            <h5 class="fw-bold">{{ isEditMode ? translationService.t('customers.modal.editTitle') : translationService.t('customers.modal.createTitle') }}</h5>
            <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
          </div>
          <div class="custom-modal-body">
            <form cForm [formGroup]="customerForm">
              <div class="mb-3">
                <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('customers.modal.nameLabel') }} *</label>
                <input formControlName="name" cFormControl [placeholder]="translationService.t('customers.modal.nameLabel')" />
                @if (customerForm.get('name')?.touched && customerForm.get('name')?.invalid) {
                  <div class="text-danger small mt-1">{{ translationService.t('common.error') }}</div>
                }
              </div>

              <div class="mb-3">
                <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('customers.modal.idLabel') }}</label>
                <input formControlName="identification" cFormControl [placeholder]="translationService.t('customers.modal.idLabel')" />
              </div>

              <c-row>
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('customers.modal.emailLabel') }}</label>
                  <input formControlName="email" cFormControl [placeholder]="translationService.t('customers.modal.emailLabel')" />
                </c-col>
                <c-col md="6" class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('customers.modal.phoneLabel') }}</label>
                  <input formControlName="phone" cFormControl [placeholder]="translationService.t('customers.modal.phoneLabel')" />
                </c-col>
              </c-row>
            </form>
          </div>
          <div class="custom-modal-footer">
            <button cButton color="light" class="border" (click)="close()">{{ translationService.t('customers.modal.cancelBtn') }}</button>
            <button cButton color="primary" [disabled]="isLoading() || customerForm.invalid" (click)="saveCustomer()">
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                {{ translationService.t('common.loading') }}
              } @else {
                {{ translationService.t('customers.modal.saveBtn') }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class CustomerModalComponent {
  readonly translationService = inject(TranslationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  isEditMode = false;
  selectedCustomerId: number | null = null;
  isLoading = signal<boolean>(false);

  customerForm: FormGroup;

  constructor(
    private customerService: CustomerService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.email]],
      phone: [''],
      identification: ['']
    });
  }

  openCreate() {
    this.isEditMode = false;
    this.selectedCustomerId = null;
    this.customerForm.reset({
      name: '',
      email: '',
      phone: '',
      identification: ''
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  openEdit(customer: CustomerDto) {
    this.isEditMode = true;
    this.selectedCustomerId = customer.id || null;
    this.customerForm.patchValue({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      identification: customer.identification || ''
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async saveCustomer() {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const formVal = this.customerForm.value;
    const payload: CustomerDto = { ...formVal, active: true };

    try {
      if (this.isEditMode) {
        payload.id = this.selectedCustomerId!;
        await this.customerService.updateCustomer(payload);
        this.notificationService.success('Customer profile updated successfully!');
      } else {
        await this.customerService.createCustomer(payload);
        this.notificationService.success('Customer registered successfully!');
      }
      this.saved.emit();
      this.close();
    } catch (e: any) {
      this.notificationService.error(e?.response?.data?.message || e?.message || 'Error saving customer.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
