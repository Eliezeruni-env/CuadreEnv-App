import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, ButtonDirective, IconDirective],
  template: `
    @if (state(); as dialog) {
      <div
        class="custom-modal-backdrop confirm-dialog-backdrop"
        (click)="onBackdropClick($event)"
      >
        <div
          class="custom-modal-content confirm-dialog-card"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-dialog-title'"
          (click)="$event.stopPropagation()"
        >
          <div class="confirm-dialog-body text-center p-4">
            <!-- Icon Header with Pulse Badge -->
            <div
              class="icon-wrapper mx-auto mb-3"
              [ngClass]="'variant-' + (dialog.variant || 'danger')"
            >
              <svg
                cIcon
                [name]="dialog.icon || 'cilTrash'"
                class="confirm-icon"
              ></svg>
            </div>

            <!-- Title -->
            <h5 id="confirm-dialog-title" class="fw-bold mb-2 text-dark">
              {{ dialog.title }}
            </h5>

            <!-- Message -->
            <p class="text-body-secondary mb-3 confirm-dialog-message">
              {{ dialog.message }}
            </p>

            <!-- Item Name Highlight Box -->
            @if (dialog.itemName) {
              <div class="item-highlight-box p-2 px-3 rounded mb-3 text-start">
                <span class="small text-secondary d-block font-size-xs text-uppercase fw-semibold">
                  {{ dialog.itemType || 'Registro seleccionado' }}
                </span>
                <span class="fw-bold text-dark font-monospace text-truncate d-block">
                  {{ dialog.itemName }}
                </span>
              </div>
            }

            <!-- Additional Details / Warning -->
            @if (dialog.details) {
              <div class="alert alert-warning py-2 px-3 small text-start mb-3 border-0 bg-warning-subtle text-warning-emphasis">
                <div class="d-flex align-items-center">
                  <svg cIcon name="cilWarning" class="me-2 flex-shrink-0" style="width: 14px; height: 14px;"></svg>
                  <span>{{ dialog.details }}</span>
                </div>
              </div>
            }

            <!-- Action Buttons -->
            <div class="d-flex gap-2 justify-content-end mt-4 pt-2 border-top">
              <button
                type="button"
                cButton
                color="light"
                class="border px-3"
                (click)="cancel()"
              >
                {{ dialog.cancelText || 'Cancelar' }}
              </button>
              <button
                type="button"
                cButton
                [color]="dialog.variant === 'warning' ? 'warning' : (dialog.variant === 'primary' ? 'primary' : 'danger')"
                class="px-4 text-white fw-semibold shadow-sm"
                (click)="confirm()"
                autofocus
              >
                {{ dialog.confirmText || 'Eliminar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-dialog-backdrop {
      z-index: 1070;
      backdrop-filter: blur(5px);
      background-color: rgba(15, 23, 42, 0.6);
      animation: fadeIn 0.15s ease-out;
    }

    .confirm-dialog-card {
      max-width: 440px;
      width: 90%;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
      animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(229, 231, 235, 0.8);
    }

    [data-coreui-theme="dark"] .confirm-dialog-card {
      background-color: #0f172a !important;
      border-color: #1e293b !important;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
    }

    .icon-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;

      &.variant-danger {
        background-color: rgba(239, 68, 68, 0.12);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.25);
      }

      &.variant-warning {
        background-color: rgba(245, 158, 11, 0.12);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.25);
      }

      &.variant-primary {
        background-color: rgba(79, 70, 229, 0.12);
        color: #4f46e5;
        border: 1px solid rgba(79, 70, 229, 0.25);
      }

      .confirm-icon {
        width: 26px;
        height: 26px;
      }
    }

    .confirm-dialog-message {
      font-size: 0.95rem;
      line-height: 1.45;
    }

    .item-highlight-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    [data-coreui-theme="dark"] .item-highlight-box {
      background-color: #1e293b;
      border-color: #334155;
    }

    .font-size-xs {
      font-size: 0.72rem;
      letter-spacing: 0.05em;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from {
        transform: scale(0.95) translateY(8px);
        opacity: 0;
      }
      to {
        transform: scale(1) translateY(0);
        opacity: 1;
      }
    }
  `]
})
export class ConfirmDialogComponent {
  private confirmService = inject(ConfirmDialogService);
  readonly state = this.confirmService.state;

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.state()) {
      this.cancel();
    }
  }

  onBackdropClick(event: MouseEvent) {
    this.cancel();
  }

  confirm() {
    this.confirmService.handleConfirm();
  }

  cancel() {
    this.confirmService.handleCancel();
  }
}
