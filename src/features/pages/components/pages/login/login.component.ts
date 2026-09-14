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

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
  ],
})
export class LoginComponent {
  readonly translationService = inject(TranslationService);
  loginForm: FormGroup;
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
  }

  toggleShowPassword() {
    this.showPassword.update((val) => !val);
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
      const companyId = this.authService.companyId();
      const isSuperUser = this.authService.isSuperUser();

      if (!companyId && !isSuperUser) {
        this.router.navigate(['/companies/create']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (error: any) {
      const responseBody = error?.error ?? error?.response?.data;
      console.error('login error', error);
      try {
        console.error(
          'login error details',
          JSON.stringify(
            {
              status: error?.status,
              statusText: error?.statusText,
              url: error?.url,
              body: responseBody,
            },
            null,
            2,
          ),
        );
      } catch {
        console.error('login error details', String(error));
      }

      const errorCode = String(responseBody?.errorCode || responseBody?.code || '').trim().toUpperCase();
      const serverMsg = typeof responseBody?.message === 'string' ? responseBody.message : (error?.message || '');

      // Check specifically if the user is deactivated / inactive
      if (
        errorCode === 'USER_INACTIVE' ||
        serverMsg.toLowerCase().includes('desactivad') ||
        serverMsg.toLowerCase().includes('inactiv')
      ) {
        this.errorMessage.set(
          serverMsg || 'Este usuario está desactivado. Comuníquese con el administrador para reactivar su cuenta.',
        );
        return;
      }

      const errors = responseBody?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        this.errorMessage.set(errors.join(', '));
      } else if (errors && typeof errors === 'object') {
        const errorList = Object.values(errors).flat();
        this.errorMessage.set(errorList.length > 0 ? errorList.join(', ') : (serverMsg || 'Error al iniciar sesión.'));
      } else {
        this.errorMessage.set(
          serverMsg || 'No se pudo iniciar sesión. Por favor verifique sus credenciales.',
        );
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
