import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InvitationService } from '../../../services/invitation.service';
import { IconDirective } from '@coreui/icons-angular';
import { NgIf } from '@angular/common';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent,
  AlertComponent,
  SpinnerComponent
} from '@coreui/angular';

@Component({
  selector: 'app-accept-invitation',
  templateUrl: './accept-invitation.component.html',
  standalone: true,
  imports: [
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    FormDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    IconDirective,
    FormControlDirective,
    ButtonDirective,
    ReactiveFormsModule,
    AlertComponent,
    SpinnerComponent,
    RouterLink,
    NgIf
  ]
})
export class AcceptInvitationComponent implements OnInit {
  acceptForm!: FormGroup;
  token: string | null = null;
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private invitationService: InvitationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token');
    
    if (!this.token) {
      this.errorMessage.set('Invitation token is missing. Please check your invitation link.');
    }

    this.acceptForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      repeatPassword: ['', [Validators.required]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      userName: ['', [Validators.required]],
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('repeatPassword')?.value
      ? null : { mismatch: true };
  }

  async onSubmit() {
    if (this.acceptForm.invalid || !this.token) {
      this.acceptForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const formVal = this.acceptForm.value;

    try {
      const res = await this.invitationService.acceptInvitation({
        token: this.token,
        password: formVal.password,
        firstName: formVal.firstName,
        lastName: formVal.lastName,
        userName: formVal.userName,
        role: null // assigned by backend token
      });

      if (res.success) {
        this.successMessage.set('Invitation accepted successfully! Redirecting to login...');
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      } else {
        this.errorMessage.set(res.message || 'Failed to accept invitation.');
      }
    } catch (error: any) {
      const serverMsg = error?.response?.data?.message || error?.message;
      const errors = error?.response?.data?.errors;
      if (errors && errors.length > 0) {
        this.errorMessage.set(errors.join(', '));
      } else {
        this.errorMessage.set(serverMsg || 'An error occurred while accepting invitation.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
