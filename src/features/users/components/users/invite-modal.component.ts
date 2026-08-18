import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InvitationService } from '../../services/invitation.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  SpinnerComponent
} from '@coreui/angular';

@Component({
  selector: 'app-invite-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    SpinnerComponent,
    IconDirective
  ],
  template: `
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div class="custom-modal-content" (click)="$event.stopPropagation()">
          <div class="custom-modal-header">
            <h5 class="fw-bold">{{ translationService.t('users.modal.inviteTitle') }}</h5>
            <button type="button" class="btn-close" (click)="close()" aria-label="Close"></button>
          </div>
          
          <div class="custom-modal-body">
            @if (generatedInviteUrl()) {
              <div class="text-center py-3">
                <svg cIcon name="cilCheckCircle" size="xl" class="text-success mb-3" style="width: 48px; height: 48px;"></svg>
                <h5 class="fw-bold text-dark">{{ translationService.t('common.success') }}</h5>
                
                <div class="p-2 border rounded font-monospace small text-dark bg-light text-break mb-3 select-all">
                  {{ generatedInviteUrl() }}
                </div>
                
                <button cButton color="primary" class="w-100 py-2" (click)="copyToClipboard(generatedInviteUrl()!)">
                  Copy Invitation URL
                </button>
              </div>
            } @else {
              <form cForm [formGroup]="inviteForm">
                <div class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">{{ translationService.t('users.modal.emailLabel') }} *</label>
                  <input formControlName="email" cFormControl [placeholder]="translationService.t('users.modal.emailLabel')" />
                  @if (inviteForm.get('email')?.touched && inviteForm.get('email')?.invalid) {
                    <div class="text-danger small mt-1">{{ translationService.t('common.error') }}</div>
                  }
                </div>

                <div class="mb-3">
                  <label class="small fw-semibold text-secondary mb-1">Validity (Days) *</label>
                  <input type="number" formControlName="validDays" cFormControl />
                </div>
              </form>
            }
          </div>

          <div class="custom-modal-footer">
            <button cButton color="light" class="border" (click)="close()">
              {{ generatedInviteUrl() ? translationService.t('common.close') : translationService.t('common.cancel') }}
            </button>
            @if (!generatedInviteUrl()) {
              <button cButton color="primary" [disabled]="isLoading() || inviteForm.invalid" (click)="sendInvitation()">
                @if (isLoading()) {
                  <c-spinner size="sm" class="me-2"></c-spinner>
                  {{ translationService.t('common.loading') }}
                } @else {
                  {{ translationService.t('users.modal.sendInvite') }}
                }
              </button>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class InviteModalComponent {
  readonly translationService = inject(TranslationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  isLoading = signal<boolean>(false);
  generatedInviteUrl = signal<string | null>(null);

  inviteForm: FormGroup;

  constructor(
    private invitationService: InvitationService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.inviteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      validDays: [7, [Validators.required, Validators.min(1)]]
    });
  }

  open() {
    this.generatedInviteUrl.set(null);
    this.inviteForm.reset({
      email: '',
      validDays: 7
    });
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async sendInvitation() {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const formVal = this.inviteForm.value;

    try {
      const res = await this.invitationService.createInvitation(formVal.email, formVal.validDays);
      if (res.success && res.data) {
        // Construct join URL
        const domain = window.location.origin;
        const joinLink = `${domain}/#/accept-invitation?token=${res.data.token}`;
        this.generatedInviteUrl.set(joinLink);
        this.notificationService.success('Invitation token created!');
        this.saved.emit();
      } else {
        this.notificationService.error(res.message || 'Failed to create invitation.');
      }
    } catch (e: any) {
      this.notificationService.error(e?.response?.data?.message || e?.message || 'Error generating invitation.');
    } finally {
      this.isLoading.set(false);
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    this.notificationService.success('Copied invitation URL to clipboard!');
  }
}
