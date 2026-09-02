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
import { CustomerService } from '../../../customers/services/customer.service';
import { ReceivableService } from '../../services/receivable.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { CustomerDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  FormSelectDirective,
  SpinnerComponent,
} from '@coreui/angular';

@Component({
  selector: 'app-create-receivable-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    FormSelectDirective,
    SpinnerComponent,
  ],
  template: `
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div
          class="custom-modal-content receivable-modal-container"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="custom-modal-header border-0 pb-0">
            <div class="d-flex align-items-center gap-3">
              <div class="modal-header-icon-box">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-primary"
                >
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  ></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <h5 class="fw-bold mb-0 text-body">Nueva Venta por Cobrar</h5>
            </div>
            <button
              type="button"
              class="btn-close"
              (click)="close()"
              aria-label="Close"
            ></button>
          </div>

          <!-- Body -->
          <div class="custom-modal-body pt-3">
            <form cForm [formGroup]="receivableForm">
              <!-- Section 1: Información del cliente -->
              <div class="form-section mb-4">
                <h6 class="section-title">Información del cliente</h6>

                <!-- Cliente Search / Select Row -->
                <div class="mb-3">
                  <label class="form-label required-label">Cliente</label>
                  <div class="input-group">
                    <span class="input-group-text bg-light border-end-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="text-muted"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    </span>
                    <select
                      cSelect
                      formControlName="customerId"
                      class="border-start-0 border-end-0"
                      (change)="onCustomerSelect($event)"
                    >
                      <option value="">Buscar cliente...</option>
                      @for (c of customers(); track c.id) {
                        <option [value]="c.id">
                          {{ c.name }} {{ c.identification ? '(' + c.identification + ')' : '' }}
                        </option>
                      }
                    </select>
                    <button
                      type="button"
                      class="btn btn-outline-secondary px-3"
                      title="Nuevo cliente rápido"
                      (click)="toggleQuickCustomer()"
                    >
                      +
                    </button>
                  </div>
                </div>

                @if (isQuickCustomer()) {
                  <div class="mb-3 p-3 bg-light rounded-3 border">
                    <label class="form-label required-label">Nombre del nuevo cliente</label>
                    <input
                      type="text"
                      cFormControl
                      formControlName="quickCustomerName"
                      placeholder="Ej. Roberto Sánchez"
                    />
                  </div>
                }

                <!-- Phone & Email 2-column -->
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Teléfono</label>
                    <input
                      type="text"
                      cFormControl
                      formControlName="customerPhone"
                      placeholder="809-000-0000"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Correo electrónico</label>
                    <input
                      type="email"
                      cFormControl
                      formControlName="customerEmail"
                      placeholder="cliente@correo.com"
                    />
                  </div>
                </div>
              </div>

              <!-- Section 2: Detalles de la venta -->
              <div class="form-section mb-4">
                <h6 class="section-title">Detalles de la venta</h6>

                <div class="mb-3">
                  <label class="form-label required-label"
                    >Descripción / Concepto</label
                  >
                  <input
                    type="text"
                    cFormControl
                    formControlName="description"
                    placeholder="Ej. Venta de mercadería, servicios, etc."
                  />
                </div>

                <div class="mb-3">
                  <label class="form-label required-label"
                    >Monto total de la deuda</label
                  >
                  <div class="input-group">
                    <span class="input-group-text currency-addon fw-semibold"
                      >RD$</span
                    >
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      cFormControl
                      formControlName="totalAmount"
                      placeholder="0.00"
                      (input)="calculateInstallments()"
                    />
                  </div>
                </div>
              </div>

              <!-- Section 3: Plan de pago Box -->
              <div class="payment-plan-card mb-3">
                <h6 class="plan-card-title">Plan de pago</h6>

                <!-- Installment Amount & Quantity -->
                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <label class="form-label required-label"
                      >Monto por cuota (fija)</label
                    >
                    <div class="input-group">
                      <span class="input-group-text currency-addon fw-semibold"
                        >RD$</span
                      >
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        cFormControl
                        formControlName="installmentAmount"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label required-label"
                      >Cantidad de cuotas</label
                    >
                    <div class="input-group">
                      <input
                        type="number"
                        min="1"
                        cFormControl
                        formControlName="totalInstallments"
                        placeholder="1"
                        (input)="calculateInstallments()"
                      />
                      <span class="input-group-text bg-light text-muted"
                        >Cuotas</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Start Date & Frequency -->
                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <label class="form-label required-label"
                      >Fecha de inicio del plan</label
                    >
                    <input
                      type="date"
                      cFormControl
                      formControlName="startDate"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label required-label"
                      >Frecuencia de pago</label
                    >
                    <select cSelect formControlName="frequency">
                      <option value="Semanal">Semanal</option>
                      <option value="Quincenal">Quincenal</option>
                      <option value="Mensual">Mensual</option>
                      <option value="Diaria">Diaria</option>
                    </select>
                  </div>
                </div>

                <!-- Info Notice Box -->
                <div class="plan-info-alert">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="info-alert-icon flex-shrink-0"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>
                    Se generará un plan de pago con cuotas fijas según la
                    frecuencia seleccionada.
                  </span>
                </div>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div class="custom-modal-footer">
            <button
              cButton
              color="light"
              class="border px-4"
              (click)="close()"
            >
              Cancelar
            </button>
            <button
              cButton
              class="btn-primary-custom px-4"
              [disabled]="isLoading() || receivableForm.invalid"
              (click)="saveReceivable()"
            >
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                Guardando...
              } @else {
                Guardar Venta
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .receivable-modal-container {
        max-width: 580px;
        width: 100%;
        border-radius: 16px;
      }
      .modal-header-icon-box {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: rgba(79, 70, 229, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .section-title {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--cui-body-color, #1e293b);
        margin-bottom: 0.85rem;
      }
      .required-label::after {
        content: ' *';
        color: #ef4444;
      }
      .form-label {
        font-size: 0.83rem;
        font-weight: 600;
        color: var(--cui-secondary-color, #64748b);
        margin-bottom: 0.35rem;
      }
      .currency-addon {
        background-color: var(--cui-tertiary-bg, #f8fafc);
        color: var(--cui-secondary-color, #475569);
        font-size: 0.85rem;
      }
      .payment-plan-card {
        background: #f8faff;
        border: 1.5px solid #e0e7ff;
        border-radius: 12px;
        padding: 1.25rem;
      }
      :host-context([data-coreui-theme='dark']) .payment-plan-card {
        background: rgba(79, 70, 229, 0.05);
        border-color: rgba(99, 102, 241, 0.2);
      }
      .plan-card-title {
        font-size: 0.9rem;
        font-weight: 700;
        color: #4338ca;
        margin-bottom: 1rem;
      }
      :host-context([data-coreui-theme='dark']) .plan-card-title {
        color: #818cf8;
      }
      .plan-info-alert {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        background: #eef2ff;
        color: #4f46e5;
        font-size: 0.82rem;
        font-weight: 500;
      }
      :host-context([data-coreui-theme='dark']) .plan-info-alert {
        background: rgba(79, 70, 229, 0.15);
        color: #a5b4fc;
      }
      .btn-primary-custom {
        background: #4f46e5 !important;
        border-color: #4f46e5 !important;
        color: #ffffff !important;
        font-weight: 600;
        border-radius: 8px;
        transition: all 0.2s ease-in-out;
      }
      .btn-primary-custom:hover {
        background: #4338ca !important;
        border-color: #4338ca !important;
      }
    `,
  ],
})
export class CreateReceivableModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);
  private readonly customerService = inject(CustomerService);
  private readonly receivableService = inject(ReceivableService);
  private readonly notificationService = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  customers = signal<CustomerDto[]>([]);
  isLoading = signal<boolean>(false);
  isQuickCustomer = signal<boolean>(false);

  receivableForm: FormGroup;

  constructor() {
    const today = new Date().toISOString().split('T')[0];
    this.receivableForm = this.fb.group({
      customerId: [''],
      quickCustomerName: [''],
      customerPhone: [''],
      customerEmail: [''],
      description: ['', [Validators.required]],
      totalAmount: [0, [Validators.required, Validators.min(0.01)]],
      installmentAmount: [0, [Validators.required, Validators.min(0.01)]],
      totalInstallments: [1, [Validators.required, Validators.min(1)]],
      startDate: [today, [Validators.required]],
      frequency: ['Quincenal', [Validators.required]],
    });
  }

  ngOnInit() {
    this.loadCustomers();
  }

  async loadCustomers() {
    try {
      const res = await this.customerService.getCustomers();
      if (res.success && res.data) {
        this.customers.set(res.data);
      }
    } catch (e: any) {
      console.error('Error loading customers:', e);
    }
  }

  open() {
    const today = new Date().toISOString().split('T')[0];
    this.receivableForm.reset({
      customerId: '',
      quickCustomerName: '',
      customerPhone: '',
      customerEmail: '',
      description: '',
      totalAmount: 0,
      installmentAmount: 0,
      totalInstallments: 1,
      startDate: today,
      frequency: 'Quincenal',
    });
    this.isQuickCustomer.set(false);
    this.visible = true;
    this.visibleChange.emit(true);
    this.loadCustomers();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  toggleQuickCustomer() {
    this.isQuickCustomer.set(!this.isQuickCustomer());
    if (this.isQuickCustomer()) {
      this.receivableForm.patchValue({ customerId: '' });
    }
  }

  onCustomerSelect(event: any) {
    const custId = parseInt(event.target.value, 10);
    if (!custId) return;
    const cust = this.customers().find((c) => c.id === custId);
    if (cust) {
      this.receivableForm.patchValue({
        customerPhone: cust.phone || '',
        customerEmail: cust.email || '',
      });
      this.isQuickCustomer.set(false);
    }
  }

  calculateInstallments() {
    const total = parseFloat(this.receivableForm.get('totalAmount')?.value) || 0;
    const installments =
      parseInt(this.receivableForm.get('totalInstallments')?.value, 10) || 1;
    if (total > 0 && installments > 0) {
      const perInstallment = parseFloat((total / installments).toFixed(2));
      this.receivableForm.patchValue(
        { installmentAmount: perInstallment },
        { emitEvent: false },
      );
    }
  }

  async saveReceivable() {
    if (this.receivableForm.invalid) {
      this.receivableForm.markAllAsTouched();
      return;
    }

    const formVal = this.receivableForm.value;
    const custId = formVal.customerId ? parseInt(formVal.customerId, 10) : null;
    let customerName = formVal.quickCustomerName;

    if (custId) {
      const found = this.customers().find((c) => c.id === custId);
      if (found) customerName = found.name;
    }

    if (!customerName && !custId) {
      customerName = 'Cliente General';
    }

    this.isLoading.set(true);

    try {
      const res = await this.receivableService.createReceivable({
        customerId: custId,
        customerName,
        customerPhone: formVal.customerPhone,
        customerEmail: formVal.customerEmail,
        description: formVal.description,
        totalAmount: parseFloat(formVal.totalAmount),
        installmentAmount: parseFloat(formVal.installmentAmount),
        totalInstallments: parseInt(formVal.totalInstallments, 10),
        startDate: formVal.startDate,
        frequency: formVal.frequency,
      });

      if (res.success) {
        this.notificationService.success(
          'Venta por cobrar registrada exitosamente.',
        );
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(
          res.message || 'Error al guardar la venta por cobrar.',
        );
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
