import {
  Component,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from '@coreui/angular';

@Component({
  selector: 'app-new-sale-choice-modal',
  standalone: true,
  imports: [CommonModule, ButtonDirective],
  template: `
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div
          class="custom-modal-content choice-modal-container"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="custom-modal-header border-0 pb-0">
            <div class="d-flex align-items-center gap-3">
              <div class="choice-icon-box">
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
                  class="text-primary"
                >
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path
                    d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
                  ></path>
                </svg>
              </div>
              <div>
                <h5 class="fw-bold mb-0 text-body">Nueva Venta</h5>
                <span class="text-muted small"
                  >¿Cómo quieres registrar esta venta?</span
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

          <!-- Body with 2 options cards -->
          <div class="custom-modal-body pt-4 pb-4">
            <div class="row g-3">
              <!-- Option 1: Venta Rápida (Contado) -->
              <div class="col-md-6">
                <div
                  class="sale-option-card card-contado h-100"
                  (click)="selectOption('quick')"
                >
                  <div class="option-icon-wrapper bg-icon-green">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="9" cy="21" r="1"></circle>
                      <circle cx="20" cy="21" r="1"></circle>
                      <path
                        d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
                      ></path>
                    </svg>
                  </div>
                  <h6 class="fw-bold text-body mb-1">🛒 Venta Rápida</h6>
                  <span class="badge badge-contado mb-2">Contado · Caja</span>
                  <p class="text-muted small mb-0">
                    Cobra al cliente ahora en efectivo, tarjeta o transferencia.
                    Descuenta inventario y registra el ingreso en Caja.
                  </p>
                  <div class="option-arrow mt-3">
                    <span class="fw-bold text-success small"
                      >Cobrar al instante →</span
                    >
                  </div>
                </div>
              </div>

              <!-- Option 2: Venta a Crédito -->
              <div class="col-md-6">
                <div
                  class="sale-option-card card-credito h-100"
                  (click)="selectOption('credit')"
                >
                  <div class="option-icon-wrapper bg-icon-indigo">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      ></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <h6 class="fw-bold text-body mb-1">📅 Venta a Crédito</h6>
                  <span class="badge badge-credito mb-2"
                    >Crédito · Cobros</span
                  >
                  <p class="text-muted small mb-0">
                    Registra la deuda del cliente, establece cuotas, frecuencia
                    y fechas de vencimiento en el módulo de Cobros.
                  </p>
                  <div class="option-arrow mt-3">
                    <span class="fw-bold text-primary small"
                      >Crear cuenta por cobrar →</span
                    >
                  </div>
                </div>
              </div>
            </div>
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
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .choice-modal-container {
        max-width: 640px;
        width: 100%;
        border-radius: 16px;
      }
      .choice-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #ede9fe;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sale-option-card {
        background: var(--cui-card-bg, #ffffff);
        border: 2px solid var(--cui-border-color, #e2e8f0);
        border-radius: 14px;
        padding: 1.3rem;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        transition: all 0.2s ease-in-out;

        &:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }
      }
      .card-contado:hover {
        border-color: #22c55e;
        background: #f0fdf4;
      }
      .card-credito:hover {
        border-color: #4f46e5;
        background: #eef2ff;
      }
      .option-icon-wrapper {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
      }
      .bg-icon-green {
        background: #dcfce7;
        color: #16a34a;
      }
      .bg-icon-indigo {
        background: #ede9fe;
        color: #4f46e5;
      }
      .badge-contado {
        background: #dcfce7;
        color: #15803d;
        font-size: 0.72rem;
        font-weight: 700;
        align-self: flex-start;
        border: 1px solid #bbf7d0;
      }
      .badge-credito {
        background: #e0e7ff;
        color: #3730a3;
        font-size: 0.72rem;
        font-weight: 700;
        align-self: flex-start;
        border: 1px solid #c7d2fe;
      }
      .option-arrow {
        margin-top: auto;
      }
    `,
  ],
})
export class NewSaleChoiceModalComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() optionSelected = new EventEmitter<'quick' | 'credit'>();

  open() {
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  selectOption(opt: 'quick' | 'credit') {
    this.optionSelected.emit(opt);
    this.close();
  }
}
