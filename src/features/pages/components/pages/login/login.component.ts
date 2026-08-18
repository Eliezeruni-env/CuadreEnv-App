import { Component, signal, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../cuadreEnv/services/auth.service';
import { TranslationService } from '../../../../cuadreEnv/services/translation.service';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardGroupComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent,
  AlertComponent,
  SpinnerComponent,
} from '@coreui/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardGroupComponent,
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
  ],
})
export class LoginComponent {
  readonly translationService = inject(TranslationService);
  loginForm: FormGroup;
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.login({
        email: this.loginForm.value.email,
        password: this.loginForm.value.password,
        deviceId: 'web-browser',
      });
      // Route routing is checked by auth guard or router
      const role = this.authService.currentRole();
      const companyId = this.authService.companyId();

      if (!companyId && role === 'Admin') {
        this.router.navigate(['/companies/create']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (error: any) {
      const serverMsg = error?.response?.data?.message || error?.message;
      const errors = error?.response?.data?.errors;
      if (errors && errors.length > 0) {
        this.errorMessage.set(errors.join(', '));
      } else {
        this.errorMessage.set(
          serverMsg || 'Login failed. Please verify credentials.',
        );
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
