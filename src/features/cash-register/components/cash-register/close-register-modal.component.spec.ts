import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CloseRegisterModalComponent } from './close-register-modal.component';
import { CashRegisterService } from '../../services/cash-register.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';

describe('CloseRegisterModalComponent (Blind Cash Count Audit)', () => {
  let component: CloseRegisterModalComponent;
  let fixture: ComponentFixture<CloseRegisterModalComponent>;

  const mockCashRegisterService = {
    closeSession: vi.fn().mockImplementation((params: { closingAmount: number; notes?: string }) => {
      const expected = 5000;
      const actual = Number(params.closingAmount) || 0;
      const diff = actual - expected;
      return Promise.resolve({
        success: true,
        data: { expected, actual, diff },
      });
    }),
  };

  const mockAuthService = {
    isSuperUser: vi.fn().mockReturnValue(false),
  };

  const mockNotificationService = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    showApiError: vi.fn(),
  };

  const mockTranslationService = {
    translate: vi.fn().mockImplementation((k: string) => k),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloseRegisterModalComponent],
      providers: [
        { provide: CashRegisterService, useValue: mockCashRegisterService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: TranslationService, useValue: mockTranslationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CloseRegisterModalComponent);
    component = fixture.componentInstance;
  });

  it('should initialize with blind count (showSupervisorPeek false, countedAmount 0)', () => {
    component.open({
      id: 1,
      name: 'Caja Principal',
      cashierName: 'Cajero Demo',
      initialAmount: 2000,
      currentBalance: 8500, // Expected amount exists on session
      totalIn: 6500,
      totalOut: 0,
      openedAt: new Date().toISOString(),
      isOpen: true,
      status: 'OPEN',
    } as any);

    expect(component.visible).toBe(true);
    expect(component.countedAmount()).toBe(0);
    expect(component.form.value.closingAmount).toBe(0);
    expect(component.showSupervisorPeek()).toBe(false);
    expect(component.closeAuditResult()).toBeNull();
  });

  it('should calculate counted amount when denominations are entered', () => {
    component.open({
      id: 1,
      name: 'Caja 1',
      cashierName: 'Cajero',
      currentBalance: 5000,
    } as any);

    // Enter 2 bills of 2000 (index 0) and 1 bill of 1000 (index 1)
    component.updateDenomination(0, 2);
    component.updateDenomination(1, 1);

    expect(component.denominationSum()).toBe(5000);
    expect(component.form.value.closingAmount).toBe(5000);
    expect(component.countedAmount()).toBe(5000);
  });

  it('should prevent non-superusers from unmasking supervisor peek', () => {
    mockAuthService.isSuperUser.mockReturnValue(false);
    component.toggleSupervisorPeek();
    expect(component.showSupervisorPeek()).toBe(false);
  });

  it('should submit physical count and show audit result upon successful close', async () => {
    component.open({
      id: 1,
      name: 'Caja 1',
      cashierName: 'Cajero',
      currentBalance: 5000,
    } as any);

    component.form.patchValue({ closingAmount: 4900, notes: 'Faltante de 100 verificado' });
    await component.confirmClose();

    expect(mockCashRegisterService.closeSession).toHaveBeenCalledWith({
      closingAmount: 4900,
      notes: 'Faltante de 100 verificado',
    });
    expect(component.closeAuditResult()).toBeTruthy();
    expect(component.closeAuditResult()?.status).toBe('SHORTAGE');
    expect(component.closeAuditResult()?.difference).toBe(-100);
  });
});
