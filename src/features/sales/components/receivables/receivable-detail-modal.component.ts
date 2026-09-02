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
} from '@angular/forms';
import {
  ReceivableService,
  type ReceivableDto,
  type PaymentRecordDto,
} from '../../services/receivable.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { ConfirmDialogService } from '../../../cuadreEnv/services/confirm-dialog.service';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  FormSelectDirective,
  SpinnerComponent,
} from '@coreui/angular';

interface InstallmentItem {
  number: number;
  expectedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: 'Pagada' | 'Parcial' | 'Pendiente' | 'Vencida';
  progressPct: number;
}

interface TimelineItem {
  id: string;
  type: 'sale' | 'payment' | 'next_due' | 'final_due';
  title: string;
  subtitle?: string;
  highlightText?: string;
  date: string;
  iconType: 'doc' | 'cash' | 'calendar' | 'clock';
  colorClass: 'icon-purple' | 'icon-green' | 'icon-amber' | 'icon-red';
}

@Component({
  selector: 'app-receivable-detail-modal',
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
  templateUrl: './receivable-detail-modal.component.html',
  styleUrls: ['./receivable-detail-modal.component.scss'],
})
export class ReceivableDetailModalComponent {
  readonly translationService = inject(TranslationService);
  private readonly receivableService = inject(ReceivableService);
  private readonly customerService = inject(CustomerService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);

  @Input() visible = false;
  @Input() receivable: ReceivableDto | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() updated = new EventEmitter<void>();

  activeTab = signal<'payment' | 'cuotas' | 'timeline' | 'client' | 'sale'>('payment');
  editingPayment = signal<PaymentRecordDto | null>(null);
  isLoading = signal<boolean>(false);

  paymentForm: FormGroup;
  clientForm: FormGroup;
  saleEditForm: FormGroup;

  readonly paymentProgress = computed(() => {
    if (!this.receivable || this.receivable.totalAmount <= 0) return 0;
    const pct = Math.round(
      (this.receivable.paidAmount / this.receivable.totalAmount) * 100,
    );
    return Math.min(100, Math.max(0, pct));
  });

  readonly financialStatus = computed(() => {
    if (!this.receivable) return { type: 'pendiente', label: 'Pendiente', daysOverdue: 0 };
    if (this.receivable.pendingAmount === 0 || this.receivable.paidAmount >= this.receivable.totalAmount) {
      return { type: 'pagada', label: 'Pagada', daysOverdue: 0 };
    }

    if (this.receivable.dueDate) {
      const due = new Date(this.receivable.dueDate);
      const now = new Date();
      if (due < now && this.receivable.pendingAmount > 0) {
        const diffDays = Math.ceil((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
        return { type: 'vencida', label: 'Vencida', daysOverdue: diffDays };
      }
    }

    if (this.receivable.paidAmount > 0) {
      return { type: 'parcial', label: 'Parcial', daysOverdue: 0 };
    }

    return { type: 'pendiente', label: 'Pendiente', daysOverdue: 0 };
  });

  readonly installmentsBreakdown = computed<InstallmentItem[]>(() => {
    if (!this.receivable) return [];
    const r = this.receivable;
    const totalInst = r.paymentPlan?.totalInstallments || 1;
    const instAmount = r.paymentPlan?.installmentAmount || r.totalAmount;
    let remainingPaid = r.paidAmount;
    const result: InstallmentItem[] = [];

    const baseDate = r.dueDate || r.creationDate || new Date().toISOString();

    for (let i = 1; i <= totalInst; i++) {
      const exp = i === totalInst
        ? Math.max(0, r.totalAmount - instAmount * (totalInst - 1))
        : instAmount;

      const allocated = Math.min(exp, Math.max(0, remainingPaid));
      remainingPaid = Math.max(0, remainingPaid - allocated);
      const pending = Math.max(0, exp - allocated);
      const progress = exp > 0 ? Math.round((allocated / exp) * 100) : 0;

      let status: 'Pagada' | 'Parcial' | 'Pendiente' | 'Vencida' = 'Pendiente';
      if (allocated >= exp) {
        status = 'Pagada';
      } else if (allocated > 0) {
        status = 'Parcial';
      }

      result.push({
        number: i,
        expectedAmount: exp,
        paidAmount: allocated,
        pendingAmount: pending,
        dueDate: this.calculateInstallmentDueDate(baseDate, i, r.paymentPlan?.frequency),
        status,
        progressPct: progress,
      });
    }

    return result;
  });

  readonly timelineItems = computed<TimelineItem[]>(() => {
    if (!this.receivable) return [];
    const r = this.receivable;
    const items: TimelineItem[] = [];

    // 1. Venta creada
    const saleDate = r.creationDate || r.paymentPlan?.startDate;
    items.push({
      id: 'sale-created',
      type: 'sale',
      title: 'Venta creada',
      subtitle: 'Se creó la venta',
      date: saleDate ? this.formatTimelineDate(saleDate, '10:30 AM') : '27/05/2025 10:30 AM',
      iconType: 'doc',
      colorClass: 'icon-purple',
    });

    // 2. Pagos registrados
    if (r.payments && r.payments.length > 0) {
      r.payments.forEach((p: PaymentRecordDto, idx: number) => {
        const formattedAmount = 'RD$ ' + p.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 });
        items.push({
          id: `payment-${p.id || idx}`,
          type: 'payment',
          title: 'Pago registrado',
          highlightText: formattedAmount,
          subtitle: p.method || 'Efectivo',
          date: p.date || '27/05/2025',
          iconType: 'cash',
          colorClass: 'icon-green',
        });
      });
    }

    // 3. Factura saldada por completo (if fully paid)
    if (r.pendingAmount <= 0 || r.status === 'Pagado') {
      const lastPaymentDate = r.payments && r.payments.length > 0
        ? r.payments[r.payments.length - 1].date
        : this.formatTimelineDate(r.settledDate || new Date().toISOString());

      items.push({
        id: 'fully-settled',
        type: 'payment',
        title: 'Factura saldada por completo',
        subtitle: 'Saldo liquidado al 100%',
        highlightText: 'RD$ ' + r.totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 }),
        date: lastPaymentDate,
        iconType: 'cash',
        colorClass: 'icon-green',
      });
    }

    // 4. Cuenta reabierta (if reopened)
    if (r.isReopened) {
      items.push({
        id: 'reopened-event',
        type: 'sale',
        title: 'Cuenta por cobrar reabierta',
        subtitle: 'Reactivada para ajustes o correcciones',
        date: this.formatTimelineDate(r.reopenedDate || new Date().toISOString()),
        iconType: 'doc',
        colorClass: 'icon-amber',
      });
    }

    // 5. Próximo vencimiento (if pending amount exists)
    if (r.pendingAmount > 0) {
      const nextDueAmount = r.paymentPlan?.installmentAmount || r.pendingAmount;
      const formattedNextDue = 'RD$ ' + nextDueAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 });
      items.push({
        id: 'next-due',
        type: 'next_due',
        title: 'Próximo vencimiento',
        subtitle: formattedNextDue,
        date: r.dueDate ? this.formatShortDate(r.dueDate) : '27/06/2025',
        iconType: 'calendar',
        colorClass: 'icon-amber',
      });
    }

    // 6. Vencimiento final (if pending amount exists)
    if (r.pendingAmount > 0) {
      if (r.paymentPlan && r.paymentPlan.totalInstallments > 1) {
        const finalAmount = r.paymentPlan.installmentAmount;
        const formattedFinal = 'RD$ ' + finalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 });
        items.push({
          id: 'final-due',
          type: 'final_due',
          title: 'Vencimiento final',
          subtitle: formattedFinal,
          date: this.calculateFinalDueDate(r.dueDate || r.creationDate, r.paymentPlan.totalInstallments),
          iconType: 'clock',
          colorClass: 'icon-red',
        });
      } else if (r.dueDate) {
        const formattedTotal = 'RD$ ' + r.totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 });
        items.push({
          id: 'final-due',
          type: 'final_due',
          title: 'Vencimiento final',
          subtitle: formattedTotal,
          date: this.formatShortDate(r.dueDate),
          iconType: 'clock',
          colorClass: 'icon-red',
        });
      }
    }

    return items;
  });

  async reopenAccount() {
    if (!this.receivable) return;
    const confirmed = await this.confirmService.confirm({
      title: '¿Reabrir cuenta por cobrar?',
      message: `¿Desea reactivar esta cuenta por cobrar (${this.receivable.invoiceNumber}) para permitir registrar nuevos abonos o correcciones de saldo?`,
      confirmText: 'Sí, reactivar',
      variant: 'warning',
    });

    if (confirmed) {
      this.isLoading.set(true);
      try {
        const res = await this.receivableService.reopenReceivable(this.receivable.id);
        if (res.success && res.data) {
          this.receivable = res.data;
          this.notificationService.success('Cuenta por cobrar reactivada exitosamente.');
          this.updated.emit();
        }
      } catch (e: any) {
        this.notificationService.showApiError(e);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  private formatTimelineDate(dateStr: string, defaultTime = ''): string {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const datePart = d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return defaultTime ? `${datePart} ${defaultTime}` : datePart;
    } catch {
      return dateStr;
    }
  }

  private formatShortDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  private calculateInstallmentDueDate(baseDateStr: string, instNumber: number, frequency?: string): string {
    try {
      const d = new Date(baseDateStr);
      if (isNaN(d.getTime())) return `Mes ${instNumber}`;
      if (frequency === 'Semanal') {
        d.setDate(d.getDate() + (instNumber - 1) * 7);
      } else if (frequency === 'Quincenal') {
        d.setDate(d.getDate() + (instNumber - 1) * 15);
      } else {
        d.setMonth(d.getMonth() + (instNumber - 1));
      }
      return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return `Cuota ${instNumber}`;
    }
  }

  private calculateFinalDueDate(baseDateStr: string, installments: number): string {
    try {
      const d = new Date(baseDateStr);
      if (isNaN(d.getTime())) return '27/08/2025';
      d.setMonth(d.getMonth() + Math.max(1, installments - 1));
      return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '27/08/2025';
    }
  }

  constructor() {
    const now = new Date();
    const nowIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(0.01)]],
      paymentDate: [nowIso, [Validators.required]],
      method: ['Efectivo', [Validators.required]],
      reference: [''],
      notes: [''],
    });

    this.clientForm = this.fb.group({
      customerName: ['', [Validators.required]],
      customerPhone: [''],
      customerEmail: [''],
      customerIdentification: [''],
    });

    this.saleEditForm = this.fb.group({
      description: ['', [Validators.required]],
      totalAmount: [0, [Validators.required, Validators.min(0.01)]],
      dueDate: [''],
    });
  }

  open(item: ReceivableDto) {
    this.receivable = item;
    this.activeTab.set('payment');
    this.editingPayment.set(null);

    const now = new Date();
    const nowIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    this.paymentForm.reset({
      amount: item.paymentPlan?.installmentAmount || Math.min(item.pendingAmount, 5000),
      paymentDate: nowIso,
      method: 'Efectivo',
      reference: '',
      notes: '',
    });

    this.clientForm.reset({
      customerName: item.customerName,
      customerPhone: item.customerPhone || '',
      customerEmail: item.customerEmail || '',
      customerIdentification: item.customerIdentification || '',
    });

    this.saleEditForm.reset({
      description: item.description,
      totalAmount: item.totalAmount,
      dueDate: item.dueDate ? item.dueDate.split('T')[0] : '',
    });

    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.editingPayment.set(null);
  }

  setTab(tab: 'payment' | 'cuotas' | 'timeline' | 'client' | 'sale') {
    this.activeTab.set(tab);
    if (tab !== 'payment') {
      this.editingPayment.set(null);
    }
  }

  quickPayInstallment(item: InstallmentItem) {
    const amt = item.pendingAmount > 0 ? item.pendingAmount : item.expectedAmount;
    this.paymentForm.patchValue({
      amount: amt,
      notes: `Pago de Cuota #${item.number}`,
    });
    this.setTab('payment');
  }

  editPayment(p: PaymentRecordDto) {
    this.editingPayment.set(p);

    const now = new Date();
    const nowIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    this.paymentForm.patchValue({
      amount: p.amount,
      paymentDate: nowIso,
      method: p.method || 'Efectivo',
      reference: p.reference || '',
      notes: p.notes || '',
    });
  }

  cancelEditPayment() {
    this.editingPayment.set(null);
    const now = new Date();
    const nowIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    if (this.receivable) {
      this.paymentForm.reset({
        amount: this.receivable.paymentPlan?.installmentAmount || Math.min(this.receivable.pendingAmount, 5000),
        paymentDate: nowIso,
        method: 'Efectivo',
        reference: '',
        notes: '',
      });
    }
  }

  async deletePayment(p: PaymentRecordDto) {
    if (!this.receivable) return;

    const formattedAmount = p.amount.toLocaleString('es-DO', {
      minimumFractionDigits: 2,
    });

    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar pago registrado?',
      message: `¿Estás seguro de que deseas eliminar el pago #${p.id} por un monto de RD$ ${formattedAmount}? El saldo pendiente se recalculará automáticamente.`,
      confirmText: 'Eliminar Pago',
      variant: 'danger',
    });

    if (!confirmed) return;

    this.isLoading.set(true);

    try {
      const res = await this.receivableService.deletePayment(
        this.receivable.id,
        p.id,
      );

      if (res.success && res.data) {
        this.receivable = res.data;
        if (this.editingPayment()?.id === p.id) {
          this.cancelEditPayment();
        }
        this.notificationService.success('Pago eliminado exitosamente.');
        this.updated.emit();
      } else {
        this.notificationService.error(
          res.message || 'Error al eliminar el pago.',
        );
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveActiveTab() {
    if (this.activeTab() === 'payment') {
      await this.savePayment();
    } else if (this.activeTab() === 'client') {
      await this.saveClient();
    } else if (this.activeTab() === 'sale') {
      await this.saveSale();
    }
  }

  async savePayment() {
    if (this.paymentForm.invalid || !this.receivable) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const formVal = this.paymentForm.value;
    const amount = parseFloat(formVal.amount);

    if (amount <= 0) {
      this.notificationService.warning('El monto debe ser mayor a cero.');
      return;
    }

    this.isLoading.set(true);

    try {
      const formattedDate = new Date(formVal.paymentDate).toLocaleString(
        'es-DO',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      );

      const currentEditing = this.editingPayment();

      if (currentEditing) {
        // Update existing payment
        const res = await this.receivableService.updatePayment(
          this.receivable.id,
          currentEditing.id,
          {
            amount,
            date: formattedDate,
            method: formVal.method,
            reference: formVal.reference,
            notes: formVal.notes,
          },
        );

        if (res.success && res.data) {
          this.receivable = res.data;
          this.editingPayment.set(null);
          this.notificationService.success('Pago actualizado exitosamente.');
          this.updated.emit();
        } else {
          this.notificationService.error(
            res.message || 'Error al actualizar el pago.',
          );
        }
      } else {
        // Register new payment
        const res = await this.receivableService.addPayment(
          this.receivable.id,
          {
            amount,
            date: formattedDate,
            method: formVal.method,
            reference: formVal.reference,
            notes: formVal.notes,
          },
        );

        if (res.success && res.data) {
          this.receivable = res.data;
          this.notificationService.success('Pago registrado exitosamente y reflejado en Caja.');
          this.updated.emit();
          this.close();
        } else {
          this.notificationService.error(
            res.message || 'Error al registrar el pago.',
          );
        }
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveClient() {
    if (this.clientForm.invalid || !this.receivable) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const val = this.clientForm.value;
    this.isLoading.set(true);

    try {
      const res = await this.receivableService.updateReceivable(
        this.receivable.id,
        {
          customerName: val.customerName,
          customerPhone: val.customerPhone,
          customerEmail: val.customerEmail,
          customerIdentification: val.customerIdentification,
        },
      );

      if (res.success && res.data) {
        this.receivable = res.data;
        this.notificationService.success(
          'Información del cliente actualizada exitosamente.',
        );
        this.updated.emit();
        this.close();
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveSale() {
    if (this.saleEditForm.invalid || !this.receivable) {
      this.saleEditForm.markAllAsTouched();
      return;
    }

    const val = this.saleEditForm.value;
    const newTotal = parseFloat(val.totalAmount);
    this.isLoading.set(true);

    try {
      const newPending = Math.max(0, newTotal - this.receivable.paidAmount);
      const res = await this.receivableService.updateReceivable(
        this.receivable.id,
        {
          description: val.description,
          totalAmount: newTotal,
          pendingAmount: newPending,
          dueDate: val.dueDate,
          status: newPending === 0 ? 'Pagado' : this.receivable.paidAmount > 0 ? 'Parcial' : 'Pendiente',
        },
      );

      if (res.success && res.data) {
        this.receivable = res.data;
        this.notificationService.success(
          'Detalles de la venta actualizados exitosamente.',
        );
        this.updated.emit();
        this.close();
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
