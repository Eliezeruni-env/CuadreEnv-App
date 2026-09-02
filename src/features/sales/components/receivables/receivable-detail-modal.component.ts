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
import { ConfirmDialogService } from '../../../cuadreEnv/services/confirm-dialog.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  FormSelectDirective,
  SpinnerComponent,
} from '@coreui/angular';

export interface TimelineItem {
  id: string;
  type: 'sale' | 'payment' | 'next_due' | 'final_due';
  title: string;
  subtitle: string;
  highlightText?: string;
  date: string;
  iconType: 'doc' | 'cash' | 'calendar' | 'clock';
  colorClass: 'icon-purple' | 'icon-green' | 'icon-amber' | 'icon-red';
}

export interface InstallmentItem {
  number: number;
  expectedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: 'Pagada' | 'Parcial' | 'Pendiente' | 'Vencida';
  progressPct: number;
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
  template: `
    @if (visible && receivable) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div
          class="custom-modal-content detail-modal-container"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="custom-modal-header border-0 pb-0">
            <div class="d-flex align-items-center gap-3">
              <div class="modal-pay-icon-box">
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
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                  <path d="M12 18V6"></path>
                </svg>
              </div>
              <div>
                <h5 class="fw-bold mb-0 text-body">
                  @if (activeTab() === 'payment') {
                    @if (editingPayment()) {
                      Editar Pago #{{ editingPayment()?.id }}
                    } @else {
                      Agregar Pago a la Venta
                    }
                  } @else if (activeTab() === 'cuotas') {
                    Plan de Cuotas y Vencimientos
                  } @else if (activeTab() === 'timeline') {
                    Timeline / Actividad de la Venta
                  } @else if (activeTab() === 'client') {
                    Editar Información del Cliente
                  } @else {
                    Editar Detalles de la Venta
                  }
                </h5>
                <span class="text-muted small">
                  {{ receivable.customerName }} · {{ receivable.invoiceNumber }}
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
            <!-- Top Client Financial Status Summary Card -->
            <div class="client-summary-card mb-3">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="d-flex align-items-center gap-3">
                  <div
                    class="client-avatar"
                    [style.background-color]="receivable.avatarColor || '#ede9fe'"
                  >
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
                      class="text-dark-indigo"
                    >
                      <path
                        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                      ></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <div>
                    <h6 class="fw-bold mb-0 text-body">
                      {{ receivable.customerName }}
                    </h6>
                    <span class="text-muted small">{{ receivable.description }}</span>
                  </div>
                </div>

                <!-- Financial Status Pill Badge -->
                <div class="text-end">
                  <div class="d-flex align-items-center gap-2 mb-1 justify-content-end">
                    @if (financialStatus().type === 'pagada') {
                      <span class="badge badge-financial badge-pagada">🟢 Pagada (100%)</span>
                    } @else if (financialStatus().type === 'parcial') {
                      <span class="badge badge-financial badge-parcial">🟠 Parcial ({{ paymentProgress() }}%)</span>
                    } @else if (financialStatus().type === 'vencida') {
                      <span class="badge badge-financial badge-vencida">🔴 Vencida ({{ financialStatus().daysOverdue }} días de atraso)</span>
                    } @else {
                      <span class="badge badge-financial badge-pendiente">🟡 Pendiente (0%)</span>
                    }
                  </div>
                  <div class="small text-muted">
                    Total: <span class="fw-semibold text-body">RD$ {{ receivable.totalAmount | number: '1.2-2' }}</span>
                    · Pendiente: <span class="fw-bold text-amber">RD$ {{ receivable.pendingAmount | number: '1.2-2' }}</span>
                  </div>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="progress progress-thin mt-2">
                <div
                  class="progress-bar"
                  [ngClass]="{
                    'bg-success': financialStatus().type === 'pagada',
                    'bg-primary': financialStatus().type === 'parcial',
                    'bg-danger': financialStatus().type === 'vencida',
                    'bg-warning': financialStatus().type === 'pendiente'
                  }"
                  role="progressbar"
                  [style.width.%]="paymentProgress()"
                ></div>
              </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="nav-tabs-custom mb-3">
              <button
                type="button"
                class="tab-btn"
                [class.active]="activeTab() === 'payment'"
                (click)="setTab('payment')"
              >
                Registrar Pago
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="activeTab() === 'cuotas'"
                (click)="setTab('cuotas')"
              >
                Plan de Cuotas
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="activeTab() === 'timeline'"
                (click)="setTab('timeline')"
              >
                Timeline / Actividad
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="activeTab() === 'client'"
                (click)="setTab('client')"
              >
                Editar Cliente
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="activeTab() === 'sale'"
                (click)="setTab('sale')"
              >
                Editar Venta
              </button>
            </div>

            <!-- TAB 1: REGISTRAR / EDITAR PAGO -->
            @if (activeTab() === 'payment') {
              <form cForm [formGroup]="paymentForm">
                <!-- Información del pago -->
                <div class="form-section mb-4">
                  <div class="d-flex align-items-center justify-content-between mb-2">
                    <h6 class="section-title mb-0">
                      @if (editingPayment()) {
                        <span class="text-primary">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Editando Pago #{{ editingPayment()?.id }}
                        </span>
                      } @else {
                        Información del pago
                      }
                    </h6>
                    @if (editingPayment()) {
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary py-0 px-2 small"
                        (click)="cancelEditPayment()"
                      >
                        ✕ Cancelar edición
                      </button>
                    }
                  </div>

                  <!-- Row 1: Amount & DateTime -->
                  <div class="row g-3 mb-3">
                    <div class="col-md-6">
                      <label class="form-label required-label"
                        >Monto del pago</label
                      >
                      <div class="input-group">
                        <span
                          class="input-group-text currency-addon fw-semibold"
                          >RD$</span
                        >
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          cFormControl
                          formControlName="amount"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label required-label"
                        >Fecha y hora del pago</label
                      >
                      <input
                        type="datetime-local"
                        cFormControl
                        formControlName="paymentDate"
                      />
                    </div>
                  </div>

                  <!-- Row 2: Method & Reference -->
                  <div class="row g-3 mb-3">
                    <div class="col-md-6">
                      <label class="form-label required-label"
                        >Método de pago (Se reflejará en Caja)</label
                      >
                      <select cSelect formControlName="method">
                        <option value="Efectivo">💵 Efectivo (Registra en Caja)</option>
                        <option value="Transferencia">🏦 Transferencia Bancaria</option>
                        <option value="Tarjeta">💳 Tarjeta de Crédito / Débito</option>
                        <option value="Cheque">📄 Cheque</option>
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Referencia / Comprobante</label>
                      <input
                        type="text"
                        cFormControl
                        formControlName="reference"
                        placeholder="Ej. No. de transacción, recibo, etc."
                      />
                    </div>
                  </div>

                  <!-- Row 3: Notes -->
                  <div>
                    <label class="form-label">Notas (opcional)</label>
                    <input
                      type="text"
                      cFormControl
                      formControlName="notes"
                      placeholder="Agregar una nota..."
                    />
                  </div>
                </div>

                <!-- Historial de pagos -->
                <div class="form-section mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="section-title mb-0">Historial de pagos</h6>
                    <button
                      type="button"
                      class="btn btn-sm btn-link text-primary text-decoration-none p-0 small fw-semibold"
                      (click)="setTab('timeline')"
                    >
                      Ver Timeline completo →
                    </button>
                  </div>

                  <div class="table-responsive payment-history-table-box">
                    <table class="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th style="width: 40px;">#</th>
                          <th>Monto</th>
                          <th>Fecha y hora</th>
                          <th>Método</th>
                          <th>Referencia</th>
                          <th class="text-end" style="min-width: 90px;">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (p of receivable.payments; track p.id) {
                          <tr [class.table-active]="editingPayment()?.id === p.id">
                            <td class="text-muted small fw-semibold">
                              {{ p.id }}
                            </td>
                            <td class="fw-bold text-body">
                              RD$ {{ p.amount | number: '1.2-2' }}
                            </td>
                            <td class="small text-muted">
                              {{ p.date }}
                              @if (p.isCurrent) {
                                <span class="badge badge-este-pago ms-1"
                                  >Este pago</span
                                >
                              }
                            </td>
                            <td>
                              <span class="small">{{ p.method }}</span>
                            </td>
                            <td class="small text-muted font-monospace">
                              {{ p.reference || '-' }}
                            </td>
                            <td class="text-end">
                              <div class="d-inline-flex align-items-center gap-1">
                                <!-- Edit Payment Button -->
                                <button
                                  type="button"
                                  class="btn btn-sm btn-icon-action btn-action-edit"
                                  title="Editar este pago"
                                  (click)="editPayment(p)"
                                >
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
                                  >
                                    <path
                                      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                    ></path>
                                    <path
                                      d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                    ></path>
                                  </svg>
                                </button>

                                <!-- Delete Payment Button -->
                                <button
                                  type="button"
                                  class="btn btn-sm btn-icon-action btn-action-delete"
                                  title="Eliminar este pago"
                                  (click)="deletePayment(p)"
                                >
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
                                  >
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path
                                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                    ></path>
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        }
                        @if (receivable.payments.length === 0) {
                          <tr>
                            <td
                              colspan="6"
                              class="text-center text-muted py-3 small"
                            >
                              No hay pagos registrados aún.
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Bottom Progress & Metric Summary Box -->
                <div class="metrics-summary-bar">
                  <div class="row align-items-center g-2 text-center text-md-start">
                    <div class="col-md-4 border-end-md">
                      <span class="metrics-label">Total pagado</span>
                      <h6 class="metrics-val text-body mb-0">
                        RD$ {{ receivable.paidAmount | number: '1.2-2' }}
                      </h6>
                    </div>
                    <div class="col-md-4 border-end-md">
                      <span class="metrics-label">Pendiente</span>
                      <h6 class="metrics-val text-amber mb-0">
                        RD$ {{ receivable.pendingAmount | number: '1.2-2' }}
                      </h6>
                    </div>
                    <div class="col-md-4">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="metrics-label">Progreso</span>
                        <span class="small fw-bold text-primary"
                          >{{ paymentProgress() }}%</span
                        >
                      </div>
                      <div class="progress progress-thin">
                        <div
                          class="progress-bar bg-primary"
                          role="progressbar"
                          [style.width.%]="paymentProgress()"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            }

            <!-- TAB 2: PLAN DE CUOTAS (SEPARACIÓN CUOTA vs PAGO) -->
            @if (activeTab() === 'cuotas') {
              <div class="cuotas-breakdown-card p-3 p-md-4">
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div>
                    <h6 class="timeline-title mb-0">Plan de Cuotas y Amortización</h6>
                    <span class="text-muted small">
                      {{ installmentsBreakdown().length }} cuotas · Frecuencia: {{ receivable.paymentPlan?.frequency || 'Mensual' }}
                    </span>
                  </div>
                  <div class="text-end">
                    <span class="badge bg-light text-dark border px-3 py-2 fw-semibold">
                      Monto por cuota: RD$ {{ (receivable.paymentPlan?.installmentAmount || receivable.totalAmount) | number: '1.2-2' }}
                    </span>
                  </div>
                </div>

                <div class="table-responsive installments-table-box mb-3">
                  <table class="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Cuota</th>
                        <th>Esperado</th>
                        <th>Pagado</th>
                        <th>Pendiente</th>
                        <th>Vencimiento</th>
                        <th class="text-end">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of installmentsBreakdown(); track item.number) {
                        <tr>
                          <td class="fw-bold text-body">Cuota #{{ item.number }}</td>
                          <td class="text-body fw-semibold">
                            RD$ {{ item.expectedAmount | number: '1.2-2' }}
                          </td>
                          <td class="text-success fw-bold">
                            RD$ {{ item.paidAmount | number: '1.2-2' }}
                          </td>
                          <td class="text-body-secondary">
                            {{ item.pendingAmount > 0 ? ('RD$ ' + (item.pendingAmount | number: '1.2-2')) : '-' }}
                          </td>
                          <td class="small text-muted">{{ item.dueDate }}</td>
                          <td class="text-end">
                            @if (item.status === 'Pagada') {
                              <span class="badge bg-success-subtle text-success border">✓ Pagada</span>
                            } @else if (item.status === 'Parcial') {
                              <span class="badge bg-warning-subtle text-warning-emphasis border me-1">🟠 Parcial ({{ item.progressPct }}%)</span>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary py-0 px-2 small"
                                (click)="quickPayInstallment(item)"
                              >
                                Abonar
                              </button>
                            } @else if (item.status === 'Vencida') {
                              <span class="badge bg-danger-subtle text-danger border me-1">🔴 Vencida</span>
                              <button
                                type="button"
                                class="btn btn-sm btn-danger text-white py-0 px-2 small"
                                (click)="quickPayInstallment(item)"
                              >
                                Pagar
                              </button>
                            } @else {
                              <span class="badge bg-secondary-subtle text-secondary border me-1">○ Pendiente</span>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary py-0 px-2 small"
                                (click)="quickPayInstallment(item)"
                              >
                                Pagar
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }

            <!-- TAB 3: TIMELINE / ACTIVIDAD -->
            @if (activeTab() === 'timeline') {
              <div class="timeline-container-card p-3 p-md-4">
                <div class="timeline-header mb-4">
                  <h6 class="timeline-title mb-1">Timeline / Actividad</h6>
                  <span class="text-muted small">Historial de eventos, cobros y vencimientos de la cuenta</span>
                </div>

                <div class="timeline-list">
                  @for (item of timelineItems(); track item.id) {
                    <div class="timeline-item">
                      <!-- Icon Bubble Node -->
                      <div class="timeline-icon-bubble" [ngClass]="item.colorClass">
                        @if (item.iconType === 'doc') {
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
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                        } @else if (item.iconType === 'cash') {
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
                          >
                            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                            <circle cx="12" cy="12" r="2"></circle>
                            <path d="M6 12h.01M18 12h.01"></path>
                          </svg>
                        } @else if (item.iconType === 'calendar') {
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
                          >
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                        } @else {
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
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        }
                      </div>

                      <!-- Content Column -->
                      <div class="timeline-content">
                        <div>
                          <div class="timeline-item-title">{{ item.title }}</div>
                          <div class="timeline-item-subtitle">
                            @if (item.highlightText) {
                              <span class="fw-bold text-success">{{ item.highlightText }}</span>
                              @if (item.subtitle) {
                                <span> · {{ item.subtitle }}</span>
                              }
                            } @else if (item.type === 'next_due' || item.type === 'final_due') {
                              <span class="fw-semibold text-body">{{ item.subtitle }}</span>
                            } @else {
                              <span>{{ item.subtitle }}</span>
                            }
                          </div>
                        </div>
                        <div class="timeline-item-date">
                          {{ item.date }}
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- TAB 4: EDITAR CLIENTE -->
            @if (activeTab() === 'client') {
              <form cForm [formGroup]="clientForm" class="py-2">
                <div class="mb-3">
                  <label class="form-label required-label"
                    >Nombre del Cliente</label
                  >
                  <input
                    type="text"
                    cFormControl
                    formControlName="customerName"
                  />
                </div>
                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <label class="form-label">Teléfono</label>
                    <input
                      type="text"
                      cFormControl
                      formControlName="customerPhone"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Correo Electrónico</label>
                    <input
                      type="email"
                      cFormControl
                      formControlName="customerEmail"
                    />
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Identificación / Cédula / RNC</label>
                  <input
                    type="text"
                    cFormControl
                    formControlName="customerIdentification"
                    placeholder="001-0000000-0"
                  />
                </div>
              </form>
            }

            <!-- TAB 5: EDITAR VENTA -->
            @if (activeTab() === 'sale') {
              <form cForm [formGroup]="saleEditForm" class="py-2">
                <div class="mb-3">
                  <label class="form-label required-label"
                    >Descripción / Concepto</label
                  >
                  <input
                    type="text"
                    cFormControl
                    formControlName="description"
                  />
                </div>
                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <label class="form-label required-label"
                      >Monto Total (RD$)</label
                    >
                    <input
                      type="number"
                      step="0.01"
                      cFormControl
                      formControlName="totalAmount"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      cFormControl
                      formControlName="dueDate"
                    />
                  </div>
                </div>
              </form>
            }
          </div>

          <!-- Footer -->
          <div class="custom-modal-footer">
            <button
              cButton
              color="light"
              class="border px-4"
              (click)="close()"
            >
              {{ (activeTab() === 'timeline' || activeTab() === 'cuotas') ? 'Cerrar' : 'Cancelar' }}
            </button>
            @if (activeTab() === 'timeline' || activeTab() === 'cuotas') {
              <button
                cButton
                class="btn-primary-custom px-4"
                (click)="setTab('payment')"
              >
                + Registrar Pago
              </button>
            } @else {
              <button
                cButton
                class="btn-primary-custom px-4"
                [disabled]="isLoading()"
                (click)="saveActiveTab()"
              >
                @if (isLoading()) {
                  <c-spinner size="sm" class="me-2"></c-spinner>
                  Guardando...
                } @else {
                  @if (activeTab() === 'payment') {
                    @if (editingPayment()) {
                      Actualizar Pago
                    } @else {
                      Guardar Pago
                    }
                  } @else {
                    Guardar Cambios
                  }
                }
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .detail-modal-container {
        max-width: 720px;
        width: 100%;
        border-radius: 16px;
      }
      .modal-pay-icon-box {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(79, 70, 229, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .client-summary-card {
        background: var(--cui-tertiary-bg, #f8fafc);
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 12px;
        padding: 0.9rem 1.1rem;
      }
      .client-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .text-dark-indigo {
        color: #4338ca;
      }
      .text-amber {
        color: #d97706;
      }
      .badge-financial {
        font-size: 0.76rem;
        font-weight: 700;
        padding: 0.35rem 0.65rem;
        border-radius: 8px;
      }
      .badge-pagada {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #bbf7d0;
      }
      .badge-parcial {
        background: #fff7ed;
        color: #c2410c;
        border: 1px solid #fed7aa;
      }
      .badge-pendiente {
        background: #fefce8;
        color: #a16207;
        border: 1px solid #fef08a;
      }
      .badge-vencida {
        background: #fef2f2;
        color: #b91c1c;
        border: 1px solid #fecaca;
      }
      .nav-tabs-custom {
        display: flex;
        border-bottom: 1.5px solid var(--cui-border-color, #e2e8f0);
        gap: 1.25rem;
        overflow-x: auto;
      }
      .tab-btn {
        background: none;
        border: none;
        padding: 0.6rem 0.2rem;
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--cui-secondary-color, #64748b);
        border-bottom: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .tab-btn:hover {
        color: var(--cui-body-color, #1e293b);
      }
      .tab-btn.active {
        color: #4f46e5;
        border-bottom-color: #4f46e5;
      }
      .section-title {
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--cui-body-color, #1e293b);
        margin-bottom: 0.75rem;
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
        color: var(--cui-secondary-color, #475569);
        font-size: 0.85rem;
      }
      .payment-history-table-box, .installments-table-box {
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 10px;
        overflow: hidden;
      }
      .payment-history-table-box th, .installments-table-box th {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: var(--cui-tertiary-bg, #f8fafc);
        color: var(--cui-secondary-color, #64748b);
        font-weight: 600;
      }
      .btn-icon-action {
        width: 30px;
        height: 30px;
        padding: 0;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        transition: all 0.15s ease-in-out;
      }
      .btn-action-edit {
        color: #4f46e5;
      }
      .btn-action-edit:hover {
        background: rgba(79, 70, 229, 0.1);
        color: #4338ca;
      }
      .btn-action-delete {
        color: #ef4444;
      }
      .btn-action-delete:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
      }
      .badge-este-pago {
        background: #dcfce7;
        color: #15803d;
        font-size: 0.7rem;
        font-weight: 600;
        border-radius: 6px;
        padding: 0.2rem 0.45rem;
      }
      .metrics-summary-bar {
        background: var(--cui-tertiary-bg, #f8fafc);
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 12px;
        padding: 0.85rem 1.1rem;
      }
      .metrics-label {
        font-size: 0.75rem;
        color: var(--cui-secondary-color, #64748b);
        display: block;
      }
      .metrics-val {
        font-size: 0.98rem;
        font-weight: 700;
      }
      .progress-thin {
        height: 6px;
        border-radius: 4px;
        background-color: rgba(79, 70, 229, 0.12);
      }
      .border-end-md {
        border-right: 1px solid var(--cui-border-color, #e2e8f0);
      }
      @media (max-width: 767px) {
        .border-end-md {
          border-right: none;
          border-bottom: 1px solid var(--cui-border-color, #e2e8f0);
          padding-bottom: 0.5rem;
          margin-bottom: 0.5rem;
        }
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

      // TIMELINE / ACTIVIDAD STYLES
      .timeline-container-card, .cuotas-breakdown-card {
        background: var(--cui-card-bg, #ffffff);
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 14px;
      }
      .timeline-title {
        font-size: 1.05rem;
        font-weight: 800;
        color: var(--cui-body-color, #0f172a);
      }
      .timeline-list {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 1.6rem;
      }
      .timeline-list::before {
        content: '';
        position: absolute;
        top: 22px;
        bottom: 22px;
        left: 21px;
        width: 2px;
        background: var(--cui-border-color, #e2e8f0);
        z-index: 1;
      }
      .timeline-item {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 1.1rem;
        z-index: 2;
      }
      .timeline-icon-bubble {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 3px solid var(--cui-card-bg, #ffffff);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

        &.icon-purple {
          background: #ede9fe;
          color: #6366f1;
        }
        &.icon-green {
          background: #dcfce7;
          color: #16a34a;
        }
        &.icon-amber {
          background: #ffedd5;
          color: #ea580c;
        }
        &.icon-red {
          background: #fee2e2;
          color: #ef4444;
        }
      }
      .timeline-content {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-top: 0.25rem;
        gap: 0.75rem;
      }
      .timeline-item-title {
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--cui-body-color, #1e293b);
        margin-bottom: 0.15rem;
      }
      .timeline-item-subtitle {
        font-size: 0.82rem;
        color: var(--cui-secondary-color, #64748b);
        margin-bottom: 0;
      }
      .timeline-item-date {
        font-size: 0.8rem;
        color: var(--cui-secondary-color, #64748b);
        white-space: nowrap;
        font-weight: 500;
      }
    `,
  ],
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
      r.payments.forEach((p, idx) => {
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

    // 3. Próximo vencimiento (if pending amount exists)
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

    // 4. Vencimiento final (if installment plan or multi-installments)
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

    return items;
  });

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
      itemName: `Pago #${p.id} (${p.method} - RD$ ${formattedAmount})`,
      itemType: 'Registro de Pago',
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
