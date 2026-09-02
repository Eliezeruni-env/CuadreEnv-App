import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CashRegisterService } from '../../services/cash-register.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import type { CashRegisterDto } from '../../../cuadreEnv/types/api';
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
  selector: 'app-cash-register-modal',
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
          
          <!-- 1. Open Register Modal Header -->
          @if (mode === 'open') {
            <div class="custom-modal-header">
              <h5 class="fw-bold">{{ translationService.t('cashRegister.modal.openTitle') }}</h5>
              <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
            </div>
            <div class="custom-modal-body">
              <form cForm [formGroup]="registerForm">
                <div class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('common.name') }} *</label>
                  <input formControlName="name" cFormControl [placeholder]="translationService.t('common.name')" />
                </div>
              </form>
            </div>
            <div class="custom-modal-footer">
              <button cButton color="light" class="border" (click)="close()">{{ translationService.t('common.cancel') }}</button>
              <button cButton color="primary" [disabled]="isLoading() || registerForm.invalid" (click)="openRegister()">
                @if (isLoading()) {
                  <c-spinner size="sm" class="me-2"></c-spinner>
                  {{ translationService.t('common.loading') }}
                } @else {
                  {{ translationService.t('cashRegister.openSession') }}
                }
              </button>
            </div>
          }

          <!-- 2. Close Register Modal Header -->
          @if (mode === 'close' && selectedRegister) {
            <div class="custom-modal-header">
              <h5 class="fw-bold">{{ translationService.t('cashRegister.modal.closeTitle') }}</h5>
              <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
            </div>
            <div class="custom-modal-body">
              <form cForm [formGroup]="closeForm">
                <div class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('cashRegister.modal.actualCash') }} *</label>
                  <input type="number" formControlName="finalBalance" cFormControl />
                </div>
              </form>
            </div>
            <div class="custom-modal-footer">
              <button cButton color="light" class="border" (click)="close()">{{ translationService.t('common.cancel') }}</button>
              <button cButton color="danger" class="text-white border-0" [disabled]="isLoading() || closeForm.invalid" (click)="closeRegister()">
                @if (isLoading()) {
                  <c-spinner size="sm" class="me-2"></c-spinner>
                  {{ translationService.t('common.loading') }}
                } @else {
                  {{ translationService.t('cashRegister.closeSession') }}
                }
              </button>
            </div>
          }

          <!-- 3. Record Movement Modal Header -->
          @if (mode === 'movement') {
            <div class="custom-modal-header">
              <h5 class="fw-bold">{{ translationService.t('cashRegister.modal.entryTitle') }}</h5>
              <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
            </div>
            <div class="custom-modal-body">
              <form cForm [formGroup]="movementForm">
                <div class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('cashRegister.title') }} *</label>
                  <select cSelect formControlName="cashRegisterId">
                    <option value="" disabled selected>{{ translationService.t('common.select') }}</option>
                    @for (r of registers(); track r.id) {
                      @if (r.isOpen) {
                        <option [value]="r.id">{{ r.name }}</option>
                      }
                    }
                  </select>
                </div>

                <c-row>
                  <c-col md="6" class="mb-3">
                    <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('cashRegister.modal.amount') }} *</label>
                    <input type="number" formControlName="amount" cFormControl />
                  </c-col>

                  <c-col md="6" class="mb-3">
                    <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('common.type') }} *</label>
                    <select cSelect formControlName="type">
                      <option value="In">{{ translationService.t('cashRegister.cashIn') }}</option>
                      <option value="Out">{{ translationService.t('cashRegister.cashOut') }}</option>
                    </select>
                  </c-col>
                </c-row>

                <div class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('cashRegister.modal.reason') }}</label>
                  <input formControlName="description" cFormControl [placeholder]="translationService.t('cashRegister.modal.reason')" />
                </div>
              </form>
            </div>
            <div class="custom-modal-footer">
              <button cButton color="light" class="border" (click)="close()">{{ translationService.t('common.cancel') }}</button>
              <button cButton color="primary" [disabled]="isLoading() || movementForm.invalid" (click)="saveMovement()">
                @if (isLoading()) {
                  <c-spinner size="sm" class="me-2"></c-spinner>
                  {{ translationService.t('common.loading') }}
                } @else {
                  {{ translationService.t('common.save') }}
                }
              </button>
            </div>
          }
          
        </div>
      </div>
    }
  `
})
export class CashRegisterModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  mode: 'open' | 'close' | 'movement' | null = null;
  selectedRegister: CashRegisterDto | null = null;
  registers = signal<CashRegisterDto[]>([]);
  isLoading = signal<boolean>(false);

  registerForm: FormGroup;
  closeForm: FormGroup;
  movementForm: FormGroup;

  constructor(
    private cashRegisterService: CashRegisterService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]]
    });

    this.closeForm = this.fb.group({
      finalBalance: [0, [Validators.required, Validators.min(0)]]
    });

    this.movementForm = this.fb.group({
      cashRegisterId: ['', [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      type: ['In', [Validators.required]],
      description: ['', [Validators.maxLength(250)]]
    });
  }

  ngOnInit() {
    this.loadRegistersList();
  }

  async loadRegistersList() {
    try {
      const res = await this.cashRegisterService.getCashRegisters();
      if (res.success && res.data) {
        this.registers.set(res.data);
      }
    } catch (e: any) {
      console.error('Failed to load cash registers:', e?.message || e);
    }
  }

  openRegisterForm() {
    this.mode = 'open';
    this.registerForm.reset({ name: '' });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  openCloseForm(register: CashRegisterDto) {
    this.mode = 'close';
    this.selectedRegister = register;
    this.closeForm.reset({ finalBalance: register.balance });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  openMovementForm() {
    this.mode = 'movement';
    this.loadRegistersList();
    this.movementForm.reset({
      cashRegisterId: '',
      amount: 0,
      type: 'In',
      description: ''
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.mode = null;
    this.selectedRegister = null;
  }

  async openRegister() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const name = this.registerForm.value.name;

    try {
      const res = await this.cashRegisterService.openCashRegister(name);
      if (res.success) {
        this.notificationService.success(`Caja registradora "${name}" abierta exitosamente.`);
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Error al abrir caja.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async closeRegister() {
    if (this.closeForm.invalid || !this.selectedRegister) {
      this.closeForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const balance = this.closeForm.value.finalBalance;

    try {
      await this.cashRegisterService.closeCashRegister(this.selectedRegister.id!, balance);
      this.notificationService.success('Caja registradora cerrada exitosamente.');
      this.saved.emit();
      this.close();
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveMovement() {
    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const val = this.movementForm.value;

    try {
      await this.cashRegisterService.createCashMovement({
        cashRegisterId: parseInt(val.cashRegisterId, 10),
        amount: val.amount,
        type: val.type,
        description: val.description || null
      });
      this.notificationService.success('Movimiento de caja registrado exitosamente.');
      this.saved.emit();
      this.close();
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
