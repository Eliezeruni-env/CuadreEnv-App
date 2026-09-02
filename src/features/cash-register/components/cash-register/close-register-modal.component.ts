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
  templateUrl: './close-register-modal.component.html',
  styleUrls: ['./close-register-modal.component.scss'],
})
export class CloseRegisterModalComponent {
  readonly Math = Math;
  readonly translationService = inject(TranslationService);
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

    const val = this.form.value;

    // Strict Business Rule: If difference !== 0 (surplus or shortage), observations is mandatory
    if (Math.abs(this.diff()) > 0.01 && (!val.notes || !val.notes.trim())) {
      this.notificationService.warning(
        'Existe una diferencia en el arqueo de caja. Es obligatorio ingresar una justificación en el campo de observaciones.',
      );
      this.form.get('notes')?.markAsTouched();
      return;
    }

    this.isLoading.set(true);

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
