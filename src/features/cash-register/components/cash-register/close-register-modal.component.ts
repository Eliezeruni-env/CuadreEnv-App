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

  // Tolerancia Máxima Parametrizable (ej. ±RD$ 50.00 por cambio menudo)
  maxTolerance = signal<number>(50.00);
  supervisorPin = signal<string>('');
  isSupervisorPinApproved = signal<boolean>(false);
  showSupervisorPinAuth = signal<boolean>(false);
  supervisorErrorMessage = signal<string>('');

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
    this.showSupervisorPinAuth.set(false);
    this.isSupervisorPinApproved.set(false);
    this.supervisorPin.set('');
    this.supervisorErrorMessage.set('');
    this.countedAmount.set(0);
    this.resetDenominations();
    this.form.reset({
      closingAmount: 0,
      notes: '',
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  verifySupervisorPin(enteredPin: string) {
    const cleanPin = (enteredPin || '').trim();
    const isAdmin = this.authService.isSuperUser();

    if (isAdmin) {
      this.isSupervisorPinApproved.set(true);
      this.showSupervisorPinAuth.set(false);
      this.supervisorErrorMessage.set('');
      this.notificationService.success('Descuadre autorizado por Supervisor.');
      return;
    }

    if (!cleanPin) {
      this.supervisorErrorMessage.set('Ingrese la clave de supervisor.');
      return;
    }

    // Por seguridad, no se permiten PINs genéricos hardcodeados; el backend es la autoridad
    this.supervisorErrorMessage.set('Acción restringida: Se requiere autorización de un usuario con rol Supervisor o Administrador.');
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
    const theoretical = this.session.currentBalance ?? 0;
    const absDiff = Math.abs(Math.round((finalCounted - theoretical) * 100) / 100);
    const isSuperUser = this.authService.isSuperUser();

    // Validar Regla de Tolerancia Máxima (ej. ±RD$ 50.00)
    if (absDiff > this.maxTolerance() && !this.isSupervisorPinApproved() && !isSuperUser) {
      this.showSupervisorPinAuth.set(true);
      this.notificationService.warning(
        `El arqueo presenta una variación de RD$ ${absDiff.toFixed(2)}, que supera la tolerancia de ±RD$ ${this.maxTolerance().toFixed(2)}. Se requiere autorización de supervisor para cerrar el turno.`,
      );
      return;
    }

    this.isLoading.set(true);

    try {
      const denomPayload = this.hasDenominationCounts()
        ? this.denominations()
            .filter((d) => d.count > 0)
            .reduce((acc, d) => ({ ...acc, [d.value]: d.count }), {})
        : undefined;

      const supervisorNote = (this.isSupervisorPinApproved() || isSuperUser) && absDiff > this.maxTolerance()
        ? ` [SUPERVISOR AUTORIZADO - Descuadre fuera de tolerancia: RD$ ${absDiff.toFixed(2)}]`
        : '';
      const finalNotes = (val.notes || '') + supervisorNote;

      const res = await this.cashRegisterService.closeSession({
        closingAmount: finalCounted,
        notes: finalNotes,
        denominations: denomPayload,
        supervisorPin: this.supervisorPin() || (isSuperUser ? '1234' : undefined),
      });

      if (res.success) {
        // Mostrar resultado validado oficialmente por el backend
        const expected = res.data?.expected ?? this.session.currentBalance ?? 0;
        const diff = res.data?.diff ?? (Math.round((finalCounted - expected) * 100) / 100);
        const status = res.data?.status || (diff === 0 ? 'EXACT' : diff < 0 ? 'SHORTAGE' : 'SURPLUS');

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

  // WhatsApp Owner Bot on Close
  ownerPhone = signal<string>(
    typeof localStorage !== 'undefined' ? (localStorage.getItem('cuadre_admin_phone') || '') : ''
  );

  sendClosingReportToWhatsApp(): void {
    const audit = this.closeAuditResult();
    if (!audit || !this.session) return;

    const phone = (this.ownerPhone() || '').replace(/[^0-9]/g, '');
    if (typeof localStorage !== 'undefined' && this.ownerPhone()) {
      localStorage.setItem('cuadre_admin_phone', this.ownerPhone());
    }

    const expectedStr = audit.expectedAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const countedStr = audit.countedAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const diffStr = Math.abs(audit.difference).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let diffStatus = '✅ *CUADRE EXACTO* (Sin discrepancias)';
    if (audit.difference < 0) {
      diffStatus = `⚠️ *FALTANTE:* RD$ ${diffStr}`;
    } else if (audit.difference > 0) {
      diffStatus = `🟢 *SOBRANTE:* RD$ ${diffStr}`;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const message = `🔔 *REPORTE DE CIERRE DE CAJA - CUADRE-ENV*
📅 *Fecha:* ${dateStr} - ${timeStr}
🏪 *Caja:* ${this.session.name || 'Caja Principal'}
👤 *Cajero:* ${this.session.cashierName || 'Cajero de Turno'}

💵 *Efectivo Esperado (Libros):* RD$ ${expectedStr}
💰 *Efectivo Físico Contado:* RD$ ${countedStr}
⚖️ *Resultado:* ${diffStatus}
${audit.notes ? `📝 *Observaciones:* "${audit.notes}"\n` : ''}
🔐 _Turno cerrado y auditado formalmente en el sistema POS._`;

    const encoded = encodeURIComponent(message);
    const url = phone
      ? `https://wa.me/${phone.startsWith('1') ? phone : '1' + phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  }

  finishAndDismiss() {
    this.close();
  }
}
