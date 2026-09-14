import {
  Component,
  OnInit,
  signal,
  computed,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  CashRegisterService,
  type CashRegisterSessionDto,
  type CashRegisterMovementItem,
} from '../../services/cash-register.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { QuickSaleModalComponent } from './quick-sale-modal.component';
import { ManualMovementModalComponent } from './manual-movement-modal.component';
import { CloseRegisterModalComponent } from './close-register-modal.component';
import {
  SaleCompletedModalComponent,
  type CompletedSaleDto,
} from '../../../sales/components/sales/sale-completed-modal.component';
import { AuthPosModalComponent } from './auth-pos-modal.component';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
import {
  ButtonDirective,
  ContainerComponent,
  AlertComponent,
  SpinnerComponent,
  FormControlDirective,
  FormDirective,
  FormSelectDirective,
} from '@coreui/angular';
import { UserService } from '../../../users/services/user.service';

@Component({
  selector: 'app-cash-register',
  templateUrl: './cash-register.component.html',
  styleUrls: ['./cash-register.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ContainerComponent,
    ButtonDirective,
    AlertComponent,
    SpinnerComponent,
    FormControlDirective,
    FormDirective,
    FormSelectDirective,
    QuickSaleModalComponent,
    ManualMovementModalComponent,
    CloseRegisterModalComponent,
    SaleCompletedModalComponent,
    AuthPosModalComponent,
    ListPaginationComponent,
  ],
})
export class CashRegisterComponent implements OnInit {
  readonly Math = Math;
  readonly translationService = inject(TranslationService);
  private readonly cashRegisterService = inject(CashRegisterService);
  private readonly notificationService = inject(NotificationService);
  public readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  @ViewChild('quickSaleModal') quickSaleModal!: QuickSaleModalComponent;
  @ViewChild('manualMovementModal') manualMovementModal!: ManualMovementModalComponent;
  @ViewChild('closeRegisterModal') closeRegisterModal!: CloseRegisterModalComponent;
  @ViewChild('saleCompletedModal') saleCompletedModal!: SaleCompletedModalComponent;
  @ViewChild('authPosModal') authPosModal!: AuthPosModalComponent;

  activeSession = signal<CashRegisterSessionDto | null>(null);
  movements = signal<CashRegisterMovementItem[]>([]);
  sessionHistory = signal<CashRegisterSessionDto[]>([]);
  cashiers = signal<{ id: number | string; name: string; email: string }[]>([]);

  activeTab = signal<'movimientos' | 'ventas' | 'ingresos' | 'egresos'>('movimientos');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  showMovementMenu = signal<boolean>(false);
  isPauseModalOpen = signal<boolean>(false);

  // Pagination signals
  movementsPage = signal<number>(1);
  movementsPageSize = signal<number>(10);
  historyPage = signal<number>(1);
  historyPageSize = signal<number>(5);

  // Modals visibility
  isQuickSaleModalOpen = false;
  isManualMovementModalOpen = false;
  isCloseModalOpen = false;
  isSaleCompletedModalOpen = false;
  lastCompletedSale: CompletedSaleDto | null = null;
  pendingPosAction: 'OPEN' | 'RESUME' | 'CLOSE' | null = null;

  openSessionForm: FormGroup;
  pauseForm: FormGroup;

  // Computed properties
  readonly currentDateFormatted = computed(() => {
    const d = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const str = d.toLocaleDateString('es-DO', options);
    return `Hoy, ${str}`;
  });

  readonly filteredMovements = computed(() => {
    const list = this.movements();
    const tab = this.activeTab();

    if (tab === 'ventas') {
      return list.filter((m) => m.category === 'Ventas');
    }
    if (tab === 'ingresos') {
      return list.filter((m) => m.type === 'Entrada' && m.category !== 'Ventas');
    }
    if (tab === 'egresos') {
      return list.filter((m) => m.type === 'Salida');
    }
    return list;
  });

  readonly pagedMovements = computed(() => {
    const list = this.filteredMovements();
    const start = (this.movementsPage() - 1) * this.movementsPageSize();
    return list.slice(start, start + this.movementsPageSize());
  });

  readonly pagedHistory = computed(() => {
    const list = this.sessionHistory();
    const start = (this.historyPage() - 1) * this.historyPageSize();
    return list.slice(start, start + this.historyPageSize());
  });

  readonly totalEntradas = computed(() => {
    return this.movements()
      .filter((m) => m.type === 'Entrada')
      .reduce((acc, m) => acc + (m.inAmount || 0), 0);
  });

  readonly totalSalidas = computed(() => {
    return this.movements()
      .filter((m) => m.type === 'Salida')
      .reduce((acc, m) => acc + (m.outAmount || 0), 0);
  });

  readonly totalTransacciones = computed(() => {
    return this.movements().length;
  });

  onMovementsPageChange(page: number) {
    this.movementsPage.set(page);
  }

  onHistoryPageChange(page: number) {
    this.historyPage.set(page);
  }

  constructor() {
    const curr = this.authService.currentUser();
    const defaultName = curr?.email ? curr.email.split('@')[0] : 'Usuario Actual';

    this.openSessionForm = this.fb.group({
      initialAmount: [10000, [Validators.required, Validators.min(0)]],
      name: ['Caja Principal 01', [Validators.required]],
      cashierName: [defaultName, [Validators.required]],
      notes: ['Fondo inicial para operaciones diarias'],
    });

    this.pauseForm = this.fb.group({
      reason: ['Almuerzo / Receso', [Validators.required]],
      notes: [''],
    });
  }

  ngOnInit() {
    this.loadData();
    this.loadCashiers();
    this.route.queryParams.subscribe((params) => {
      if (params['requiresOpenSession']) {
        this.notificationService.warning(
          'Debes aperturar un turno de caja antes de realizar ventas o cobros.',
        );
      }
    });
  }

  async loadCashiers() {
    const curr = this.authService.currentUser();
    const defaultItem = {
      id: curr?.id || 1,
      name: curr?.email ? curr.email.split('@')[0] : 'Usuario Actual',
      email: curr?.email || '',
    };
    const list = [defaultItem];

    try {
      const res = await this.userService.getUsers({ active: true, pageSize: 50 });
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        for (const u of res.data) {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.userName || u.email;
          if (!list.some((existing) => existing.email === u.email)) {
            list.push({
              id: u.id ?? 0,
              name: fullName,
              email: u.email,
            });
          }
        }
      }
    } catch {
      // If 403 or network issue, fallback quietly to current user
    }

    this.cashiers.set(list);
    if (list.length > 0) {
      this.openSessionForm.patchValue({ cashierName: list[0].name });
    }
  }

  openPauseModal() {
    this.pauseForm.reset({
      reason: 'Almuerzo / Receso',
      notes: '',
    });
    this.isPauseModalOpen.set(true);
  }

  closePauseModal() {
    this.isPauseModalOpen.set(false);
  }

  async confirmPause() {
    if (this.pauseForm.invalid) {
      this.pauseForm.markAllAsTouched();
      return;
    }
    const val = this.pauseForm.value;
    this.isLoading.set(true);
    try {
      const res = await this.cashRegisterService.pauseSession(val.reason, val.notes);
      if (res.success && res.data) {
        this.activeSession.set(res.data);
        this.notificationService.info('La caja ha sido pausada temporalmente.');
        this.closePauseModal();
      } else {
        this.notificationService.error(res.message || 'Error al pausar la caja.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  initiateResumeSession() {
    this.pendingPosAction = 'RESUME';
    if (this.authPosModal) this.authPosModal.open('Reanudar Caja');
  }

  async resumeRegisterSession() {
    this.isLoading.set(true);
    try {
      const res = await this.cashRegisterService.resumeSession();
      if (res.success && res.data) {
        this.activeSession.set(res.data);
        this.notificationService.success('Operaciones de caja reanudadas exitosamente.');
      } else {
        this.notificationService.error(res.message || 'Error al reanudar la caja.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadData() {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const [sessionRes, historyRes] = await Promise.all([
        this.cashRegisterService.getActiveSession(),
        this.cashRegisterService.getSessionHistory(),
      ]);

      if (sessionRes?.success && sessionRes.data) {
        this.activeSession.set(sessionRes.data);

        // Load movements directly from DB
        const movRes = await this.cashRegisterService.getMovements();
        if (movRes?.success && movRes.data) {
          this.movements.set(movRes.data);
        } else {
          this.movements.set([]);
        }
      } else {
        this.activeSession.set(null);
        this.movements.set([]);
      }

      if (historyRes?.success && historyRes.data) {
        this.sessionHistory.set(historyRes.data);
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message || e?.message || 'Error al cargar datos de la caja.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  setTab(tab: 'movimientos' | 'ventas' | 'ingresos' | 'egresos') {
    this.activeTab.set(tab);
  }

  toggleMovementMenu() {
    this.showMovementMenu.update((v) => !v);
  }

  initiateOpenSession() {
    if (this.openSessionForm.invalid) {
      this.openSessionForm.markAllAsTouched();
      return;
    }
    this.pendingPosAction = 'OPEN';
    if (this.authPosModal) this.authPosModal.open('Aperturar Caja');
  }

  async openRegisterSession() {
    if (this.openSessionForm.invalid) {
      this.openSessionForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const val = this.openSessionForm.value;

    try {
      const res = await this.cashRegisterService.openSession({
        name: val.name,
        initialAmount: parseFloat(val.initialAmount),
        cashierName: val.cashierName,
        notes: val.notes,
      });

      if (res.success && res.data) {
        this.activeSession.set(res.data);
        this.notificationService.success(
          `Caja "${res.data.name}" aperturada exitosamente con un fondo de RD$ ${res.data.initialAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}.`,
        );
        await this.loadData();
      } else {
        this.notificationService.error(res.message || 'Error al abrir caja.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  openQuickSaleModal() {
    this.showMovementMenu.set(false);
    if (this.quickSaleModal) {
      this.quickSaleModal.open();
    }
  }

  openManualMovementModal(type: 'Entrada' | 'Salida') {
    this.showMovementMenu.set(false);
    if (this.manualMovementModal) {
      this.manualMovementModal.open(type);
    }
  }

  initiateCloseSession() {
    this.pendingPosAction = 'CLOSE';
    if (this.authPosModal) this.authPosModal.open('Cerrar Caja');
  }

  async openCloseRegisterModal() {
    if (!this.closeRegisterModal) return;
    this.isLoading.set(true);
    try {
      const sessionRes = await this.cashRegisterService.getActiveSession();
      if (sessionRes?.success && sessionRes.data) {
        this.activeSession.set(sessionRes.data);
        this.closeRegisterModal.open(sessionRes.data);
      } else if (this.activeSession()) {
        this.closeRegisterModal.open(this.activeSession()!);
      } else {
        this.notificationService.warning('No se encontró una sesión de caja activa para cerrar.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  onQuickSaleCompleted(data: CompletedSaleDto) {
    this.lastCompletedSale = data;
    this.loadData();
    if (this.saleCompletedModal) {
      this.saleCompletedModal.open(data);
    } else {
      this.isSaleCompletedModalOpen = true;
    }
  }

  onPosAuthenticated(event: { success: boolean; pin: string }) {
    if (event.success) {
      switch (this.pendingPosAction) {
        case 'OPEN':
          this.openRegisterSession();
          break;
        case 'RESUME':
          this.resumeRegisterSession();
          break;
        case 'CLOSE':
          this.openCloseRegisterModal();
          break;
      }
    }
    this.pendingPosAction = null;
  }
}
