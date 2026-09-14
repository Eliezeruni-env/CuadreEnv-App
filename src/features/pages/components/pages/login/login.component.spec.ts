import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../../cuadreEnv/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display deactivated user error message and not navigate when user is inactive', async () => {
    const authService = TestBed.inject(AuthService) as AuthService;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    vi.spyOn(authService, 'login').mockRejectedValue({
      error: {
        statusCode: 403,
        errorCode: 'USER_INACTIVE',
        message: 'Este usuario está desactivado. Contacte al administrador para reactivar su cuenta.'
      }
    });

    component.loginForm.patchValue({
      email: 'inactive@example.com',
      password: 'password123'
    });

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Este usuario está desactivado. Contacte al administrador para reactivar su cuenta.');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });
});
