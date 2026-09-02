import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import {
  CashRegisterService,
  type CashRegisterSessionDto,
} from '../../services/cash-register.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  SpinnerComponent,
} from '@coreui/angular';

@Component({
  selector: 'app-close-register-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    SpinnerComponent,
  ],
  template: `
    @if (visible && session) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div
          class="custom-modal-content close-register-container"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="custom-modal-header border-0 pb-0">
            <div class="d-flex align-items-center gap-3">
              <div class="close-icon-box">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-danger"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div>
                <h5 class="fw-bold mb-0 text-body">Cierre y Cuadre de Caja</h5>
                <span class="text-muted small"
                  >Finalizar turno y verificar el balance de efectivo</span
                >
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
            <!-- Shift Summary Box -->
            <div class="cuadre-summary-card mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted small">Caja / Turno:</span>
                <span class="fw-semibold text-body">{{ session.name }}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted small">Cajero responsable:</span>
                <span class="fw-semibold text-body">{{ session.cashierName }}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted small">Saldo inicial (Fondo):</span>
                <span class="fw-semibold text-body"
                  >RD$ {{ session.initialAmount | number: '1.2-2' }}</span
                >
              </div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted small">(+) Total Entradas en efectivo:</span>
                <span class="fw-bold text-success"
                  >+ RD$ {{ session.totalIn | number: '1.2-2' }}</span
                >
              </div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted small">(-) Total Salidas / Gastos:</span>
                <span class="fw-bold text-danger"
                  >- RD$ {{ session.totalOut | number: '1.2-2' }}</span
                >
              </div>

              <hr class="my-2 border-secondary-subtle" />

              <div class="d-flex justify-content-between align-items-center">
                <span class="fw-bold text-body">Saldo Esperado en Caja:</span>
                <span class="fw-bold fs-5 text-body"
                  >RD$ {{ expectedAmount() | number: '1.2-2' }}</span
                >
              </div>
            </div>

            <form cForm [formGroup]="form">
              <!-- Conteo Real de Efectivo -->
              <div class="mb-3">
                <label class="form-label required-label"
                  >Efectivo contado / Monto real en caja</label
                >
                <div class="input-group">
                  <span class="input-group-text currency-addon fw-semibold">RD$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    cFormControl
                    formControlName="closingAmount"
                    (input)="onClosingAmountChange()"
                  />
                </div>
                <div class="d-flex gap-2 mt-1">
                  <button
                    type="button"
                    class="btn btn-sm btn-light border py-0 px-2 font-size-xs"
                    (click)="setCountedExact()"
                  >
                    Usar saldo esperado exacto
                  </button>
                </div>
              </div>

              <!-- Live Difference Alert Box -->
              <div
                class="diff-indicator-box mb-3"
                [class.box-exact]="diff() === 0"
                [class.box-shortage]="diff() < 0"
                [class.box-surplus]="diff() > 0"
              >
                @if (diff() === 0) {
                  <div class="d-flex align-items-center gap-2 text-success fw-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Cuadre exacto (Sin diferencias)</span>
                  </div>
                } @else if (diff() < 0) {
                  <div class="d-flex align-items-center gap-2 text-danger fw-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>Faltante de caja: RD$ {{ Math.abs(diff()) | number: '1.2-2' }}</span>
                  </div>
                } @else {
                  <div class="d-flex align-items-center gap-2 text-primary fw-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>Sobrante de caja: +RD$ {{ diff() | number: '1.2-2' }}</span>
                  </div>
                }
              </div>

              <!-- Observaciones -->
              <div>
                <label class="form-label">Notas / Observaciones del cierre</label>
                <input
                  type="text"
                  cFormControl
                  formControlName="notes"
                  placeholder="Ej. Cierre turno tarde, todo cuadrado..."
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
              color="danger"
              class="text-white fw-bold px-4"
              [disabled]="isLoading() || form.invalid"
              (click)="confirmClose()"
            >
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                Cerrando...
              } @else {
                Confirmar Cierre de Caja
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .close-register-container {
        max-width: 540px;
        width: 100%;
        border-radius: 16px;
      }
      .close-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #fee2e2;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cuadre-summary-card {
        background: var(--cui-tertiary-bg, #f8fafc);
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 12px;
        padding: 1.1rem;
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
      .diff-indicator-box {
        border-radius: 8px;
        padding: 0.75rem 1rem;
      }
      .box-exact {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
      }
      .box-shortage {
        background: #fef2f2;
        border: 1px solid #fecaca;
      }
      .box-surplus {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
      }
      .font-size-xs {
        font-size: 0.72rem;
      }
    `,
  ],
})
export class CloseRegisterModalComponent {
  readonly Math = Math;
  private cashRegisterService = inject(CashRegisterService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  @Input() visible = false;
  @Input() session: CashRegisterSessionDto | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  isLoading = signal<boolean>(false);
  form: FormGroup;

  readonly expectedAmount = computed(() => {
    return this.session ? this.session.currentBalance : 0;
  });

  countedAmount = signal<number>(0);

  readonly diff = computed(() => {
    return this.countedAmount() - this.expectedAmount();
  });

  constructor() {
    this.form = this.fb.group({
      closingAmount: [0, [Validators.required, Validators.min(0)]],
      notes: [''],
    });
  }

  open(activeSession: CashRegisterSessionDto) {
    this.session = activeSession;
    this.countedAmount.set(activeSession.currentBalance);
    this.form.reset({
      closingAmount: activeSession.currentBalance,
      notes: '',
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  setCountedExact() {
    if (this.session) {
      this.form.patchValue({ closingAmount: this.session.currentBalance });
      this.countedAmount.set(this.session.currentBalance);
    }
  }

  onClosingAmountChange() {
    const val = parseFloat(this.form.value.closingAmount) || 0;
    this.countedAmount.set(val);
  }

  async confirmClose() {
    if (this.form.invalid || !this.session) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const val = this.form.value;

    try {
      const res = await this.cashRegisterService.closeSession({
        closingAmount: parseFloat(val.closingAmount),
        notes: val.notes,
      });

      if (res.success) {
        this.notificationService.success(
          'Caja cerrada y turno finalizado exitosamente.',
        );
        this.closed.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Error al cerrar caja.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
