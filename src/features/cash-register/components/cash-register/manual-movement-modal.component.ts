import {
  Component,
  Input,
  Output,
  EventEmitter,
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
import { CashRegisterService } from '../../services/cash-register.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  FormSelectDirective,
  SpinnerComponent,
} from '@coreui/angular';

@Component({
  selector: 'app-manual-movement-modal',
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
          class="custom-modal-content manual-movement-container"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="custom-modal-header border-0 pb-0">
            <div class="d-flex align-items-center gap-3">
              <div
                class="movement-icon-box"
                [class.bg-income]="movementType() === 'Entrada'"
                [class.bg-expense]="movementType() === 'Salida'"
              >
                @if (movementType() === 'Entrada') {
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
                    class="text-success"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                } @else {
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
                    class="text-danger"
                  >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                }
              </div>
              <div>
                <h5 class="fw-bold mb-0 text-body">
                  {{ movementType() === 'Entrada' ? 'Registrar Ingreso de Efectivo' : 'Registrar Salida / Gasto' }}
                </h5>
                <span class="text-muted small">
                  {{ movementType() === 'Entrada' ? 'Entrada manual de dinero a la caja' : 'Retiro o desembolso de dinero de la caja' }}
                </span>
              </div>
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
            <!-- Type Selector Tabs -->
            <div class="movement-type-toggle mb-3">
              <button
                type="button"
                class="toggle-btn"
                [class.active-income]="movementType() === 'Entrada'"
                (click)="setMovementType('Entrada')"
              >
                🟢 Ingreso (+)
              </button>
              <button
                type="button"
                class="toggle-btn"
                [class.active-expense]="movementType() === 'Salida'"
                (click)="setMovementType('Salida')"
              >
                🔴 Salida / Gasto (-)
              </button>
            </div>

            <form cForm [formGroup]="form">
              <!-- Monto -->
              <div class="mb-3">
                <label class="form-label required-label">Monto</label>
                <div class="input-group">
                  <span class="input-group-text currency-addon fw-semibold">RD$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    cFormControl
                    formControlName="amount"
                    placeholder="0.00"
                  />
                </div>
                @if (form.get('amount')?.touched && form.get('amount')?.invalid) {
                  <div class="text-danger small mt-1">El monto debe ser mayor a cero.</div>
                }
              </div>

              <!-- Categoría -->
              <div class="mb-3">
                <label class="form-label required-label">Categoría</label>
                <select cSelect formControlName="category">
                  @if (movementType() === 'Entrada') {
                    <option value="Ingresos">Ingreso General</option>
                    <option value="Cobros">Cobro de Cuenta / Cliente</option>
                    <option value="Aporte">Aporte de Capital</option>
                    <option value="Ajuste">Ajuste Positivo</option>
                  } @else {
                    <option value="Gastos">Gasto Operativo / Transporte</option>
                    <option value="Compras">Compra de Mercancía / Suministros</option>
                    <option value="Retiro">Retiro / Depósito a Banco</option>
                    <option value="Ajuste">Ajuste Negativo</option>
                  }
                </select>
              </div>

              <!-- Descripción -->
              <div class="mb-3">
                <label class="form-label required-label">Concepto / Descripción</label>
                <input
                  type="text"
                  cFormControl
                  formControlName="description"
                  [placeholder]="movementType() === 'Entrada' ? 'Ej. Cobro adicional cliente, aporte inicial...' : 'Ej. Compra de suministros, transporte, pago servicio...'"
                />
                @if (form.get('description')?.touched && form.get('description')?.invalid) {
                  <div class="text-danger small mt-1">La descripción es obligatoria.</div>
                }
              </div>

              <!-- Referencia -->
              <div>
                <label class="form-label">Comprobante / Referencia (opcional)</label>
                <input
                  type="text"
                  cFormControl
                  formControlName="reference"
                  placeholder="Ej. Recibo #123, Factura proveedor, etc."
                />
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
              class="btn-save px-4"
              [class.btn-success-custom]="movementType() === 'Entrada'"
              [class.btn-danger-custom]="movementType() === 'Salida'"
              [disabled]="isLoading() || form.invalid"
              (click)="saveMovement()"
            >
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                Guardando...
              } @else {
                {{ movementType() === 'Entrada' ? 'Registrar Ingreso' : 'Registrar Salida' }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .manual-movement-container {
        max-width: 500px;
        width: 100%;
        border-radius: 16px;
      }
      .movement-icon-box {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .bg-income {
        background: #dcfce7;
      }
      .bg-expense {
        background: #fee2e2;
      }
      .movement-type-toggle {
        display: flex;
        background: var(--cui-tertiary-bg, #f1f5f9);
        border-radius: 10px;
        padding: 4px;
        gap: 4px;
      }
      .toggle-btn {
        flex: 1;
        border: none;
        background: transparent;
        padding: 0.55rem;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--cui-secondary-color, #64748b);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .toggle-btn.active-income {
        background: #ffffff;
        color: #15803d;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
      .toggle-btn.active-expense {
        background: #ffffff;
        color: #b91c1c;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
      .required-label::after {
        content: ' *';
        color: #ef4444;
      }
      .form-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--cui-secondary-color, #64748b);
        margin-bottom: 0.3rem;
      }
      .currency-addon {
        background-color: var(--cui-tertiary-bg, #f8fafc);
      }
      .btn-success-custom {
        background: #15803d !important;
        border-color: #15803d !important;
        color: #ffffff !important;
        font-weight: 600;
        border-radius: 8px;
      }
      .btn-danger-custom {
        background: #dc2626 !important;
        border-color: #dc2626 !important;
        color: #ffffff !important;
        font-weight: 600;
        border-radius: 8px;
      }
    `,
  ],
})
export class ManualMovementModalComponent {
  private cashRegisterService = inject(CashRegisterService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  movementType = signal<'Entrada' | 'Salida'>('Entrada');
  isLoading = signal<boolean>(false);

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      category: ['Ingresos', [Validators.required]],
      description: ['', [Validators.required, Validators.maxLength(200)]],
      reference: [''],
    });
  }

  open(type: 'Entrada' | 'Salida' = 'Entrada') {
    this.movementType.set(type);
    this.form.reset({
      amount: null,
      category: type === 'Entrada' ? 'Ingresos' : 'Gastos',
      description: '',
      reference: '',
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  setMovementType(type: 'Entrada' | 'Salida') {
    this.movementType.set(type);
    this.form.patchValue({
      category: type === 'Entrada' ? 'Ingresos' : 'Gastos',
    });
  }

  async saveMovement() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const val = this.form.value;

    try {
      const res = await this.cashRegisterService.addMovement({
        type: this.movementType(),
        category: val.category,
        description: val.description,
        amount: parseFloat(val.amount),
        reference: val.reference || null,
        paymentMethod: 'Efectivo',
      });

      if (res.success) {
        this.notificationService.success(
          `${this.movementType() === 'Entrada' ? 'Ingreso' : 'Salida'} de RD$ ${parseFloat(val.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })} registrado exitosamente.`,
        );
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Error al guardar movimiento.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
