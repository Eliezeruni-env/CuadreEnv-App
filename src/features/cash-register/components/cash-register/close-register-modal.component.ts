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
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  SpinnerComponent,
} from '@coreui/angular';

export interface DenominationRow {
  value: number;
  count: number;
  subtotal: number;
}

export interface CloseAuditResult {
  expectedAmount: number;
  countedAmount: number;
  difference: number;
  status: 'EXACT' | 'SHORTAGE' | 'SURPLUS';
  notes?: string;
  closedAt: string;
}

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
  readonly authService = inject(AuthService);
  private cashRegisterService = inject(CashRegisterService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  @Input() visible = false;
  @Input() session: CashRegisterSessionDto | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  isLoading = signal<boolean>(false);
  form: FormGroup;

  // Blind Count: Cashiers DO NOT see this by default
  showSupervisorPeek = signal<boolean>(false);

  // Result shown ONLY after backend returns calculation
  closeAuditResult = signal<CloseAuditResult | null>(null);

  // Denomination Counting Sheet
  showDenominations = signal<boolean>(false);
  denominations = signal<DenominationRow[]>([
    { value: 2000, count: 0, subtotal: 0 },
    { value: 1000, count: 0, subtotal: 0 },
    { value: 500, count: 0, subtotal: 0 },
    { value: 200, count: 0, subtotal: 0 },
    { value: 100, count: 0, subtotal: 0 },
    { value: 50, count: 0, subtotal: 0 },
    { value: 25, count: 0, subtotal: 0 },
    { value: 10, count: 0, subtotal: 0 },
    { value: 5, count: 0, subtotal: 0 },
    { value: 1, count: 0, subtotal: 0 },
  ]);

  readonly denominationSum = computed(() => {
    return this.denominations().reduce((acc, d) => acc + d.subtotal, 0);
  });

  // Split into bills (>= 50) and coins (< 50) for modern 2-column UI
  readonly bills = computed(() => this.denominations().slice(0, 6));
  readonly coins = computed(() => this.denominations().slice(6));

  readonly billsTotal = computed(() =>
    this.bills().reduce((acc, d) => acc + d.subtotal, 0),
  );
  readonly coinsTotal = computed(() =>
    this.coins().reduce((acc, d) => acc + d.subtotal, 0),
  );
  readonly hasDenominationCounts = computed(() =>
    this.denominations().some((d) => d.count > 0),
  );

  readonly cashierInitials = computed(() => {
    const name = this.session?.cashierName || 'C';
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  countedAmount = signal<number>(0);

  constructor() {
    this.form = this.fb.group({
      closingAmount: [0, [Validators.required, Validators.min(0)]],
      notes: [''],
    });
  }

  open(activeSession: CashRegisterSessionDto) {
    this.session = activeSession;
    this.closeAuditResult.set(null);
    this.showSupervisorPeek.set(false);
    this.showDenominations.set(false);
    this.countedAmount.set(0);
    this.resetDenominations();
    this.form.reset({
      closingAmount: 0,
      notes: '',
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.closeAuditResult.set(null);
  }

  toggleSupervisorPeek() {
    if (!this.authService.isSuperUser()) return;
    this.showSupervisorPeek.update((v) => !v);
  }

  toggleDenominations() {
    this.showDenominations.update((v) => !v);
  }

  updateDenomination(index: number, count: number) {
    const qty = Math.max(0, Math.floor(Number(count) || 0));
    const items = [...this.denominations()];
    items[index].count = qty;
    items[index].subtotal = items[index].value * qty;
    this.denominations.set(items);

    const sum = this.denominationSum();
    this.form.patchValue({ closingAmount: sum });
    this.countedAmount.set(sum);
  }

  resetDenominations() {
    this.denominations.update((items) =>
      items.map((it) => ({ ...it, count: 0, subtotal: 0 })),
    );
  }

  stepDenomination(index: number, delta: number) {
    const current = this.denominations()[index]?.count || 0;
    const next = Math.max(0, current + delta);
    this.updateDenomination(index, next);
  }

  clearDenominations() {
    this.resetDenominations();
    this.form.patchValue({ closingAmount: 0 });
    this.countedAmount.set(0);
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
    const finalCounted = parseFloat(val.closingAmount) || 0;

    this.isLoading.set(true);

    try {
      const res = await this.cashRegisterService.closeSession({
        closingAmount: finalCounted,
        notes: val.notes || '',
      });

      if (res.success) {
        // Compute and show backend validated result
        const expected = res.data?.expected ?? this.session.currentBalance ?? 0;
        const diff = res.data?.diff ?? (Math.round((finalCounted - expected) * 100) / 100);
        let status: 'EXACT' | 'SHORTAGE' | 'SURPLUS' = 'EXACT';
        if (diff < -0.01) status = 'SHORTAGE';
        else if (diff > 0.01) status = 'SURPLUS';

        this.closeAuditResult.set({
          expectedAmount: expected,
          countedAmount: finalCounted,
          difference: diff,
          status,
          notes: val.notes,
          closedAt: new Date().toISOString(),
        });

        this.notificationService.success(
          'Arqueo registrado y turno finalizado exitosamente.',
        );
        this.closed.emit();
      } else {
        this.notificationService.error(
          res.message || 'Error al procesar el cierre de caja.',
        );
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  finishAndDismiss() {
    this.close();
  }
}
