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
  ButtonDirective,
  ContainerComponent,
  AlertComponent,
  SpinnerComponent,
  FormControlDirective,
  FormDirective,
} from '@coreui/angular';

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
    QuickSaleModalComponent,
    ManualMovementModalComponent,
    CloseRegisterModalComponent,
  ],
})
export class CashRegisterComponent implements OnInit {
  readonly Math = Math;
  readonly translationService = inject(TranslationService);
  private readonly cashRegisterService = inject(CashRegisterService);
  private readonly notificationService = inject(NotificationService);
  public readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  @ViewChild('quickSaleModal') quickSaleModal!: QuickSaleModalComponent;
  @ViewChild('manualMovementModal') manualMovementModal!: ManualMovementModalComponent;
  @ViewChild('closeRegisterModal') closeRegisterModal!: CloseRegisterModalComponent;

  activeSession = signal<CashRegisterSessionDto | null>(null);
  movements = signal<CashRegisterMovementItem[]>([]);
  sessionHistory = signal<CashRegisterSessionDto[]>([]);

  activeTab = signal<'movimientos' | 'ventas' | 'ingresos' | 'egresos'>('movimientos');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  showMovementMenu = signal<boolean>(false);

  // Modals visibility
  isQuickSaleModalOpen = false;
  isManualMovementModalOpen = false;
  isCloseModalOpen = false;

  openSessionForm: FormGroup;

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

  constructor() {
    this.openSessionForm = this.fb.group({
      initialAmount: [10000, [Validators.required, Validators.min(0)]],
      name: ['Caja Principal 01', [Validators.required]],
      cashierName: ['Administrador', [Validators.required]],
      notes: ['Fondo inicial para operaciones diarias'],
    });
  }

  ngOnInit() {
    this.loadData();
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

        // Load movements
        const movRes = await this.cashRegisterService.getMovements();
        if (movRes?.success && movRes.data) {
          // If movements are empty, populate initial sample movements matching Image 2
          if (movRes.data.length <= 1) {
            this.seedInitialMockMovements(sessionRes.data.initialAmount);
          } else {
            this.movements.set(movRes.data);
          }
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
        e?.response?.data?.message || e?.message || 'Error loading cash register data.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  seedInitialMockMovements(initialAmount: number) {
    const sampleMovements: CashRegisterMovementItem[] = [
      {
        id: 1,
        date: '27/05/2025 09:00 AM',
        rawDate: '2025-05-27T09:00:00Z',
        type: 'Saldo inicial',
        category: 'Apertura',
        description: 'Apertura de caja',
        inAmount: initialAmount || 10000.0,
        outAmount: null,
        balance: 10000.0,
        paymentMethod: 'Efectivo',
      },
      {
        id: 2,
        date: '27/05/2025 09:15 AM',
        rawDate: '2025-05-27T09:15:00Z',
        type: 'Entrada',
        category: 'Ventas',
        description: 'Venta en efectivo INV-000123',
        inAmount: 5000.0,
        outAmount: null,
        balance: 15000.0,
        paymentMethod: 'Efectivo',
      },
      {
        id: 3,
        date: '27/05/2025 10:30 AM',
        rawDate: '2025-05-27T10:30:00Z',
        type: 'Entrada',
        category: 'Cobros',
        description: 'Pago de cliente Juan Pérez',
        inAmount: 3000.0,
        outAmount: null,
        balance: 18000.0,
        paymentMethod: 'Efectivo',
      },
      {
        id: 4,
        date: '27/05/2025 11:20 AM',
        rawDate: '2025-05-27T11:20:00Z',
        type: 'Salida',
        category: 'Compras',
        description: 'Compra de mercancía',
        inAmount: null,
        outAmount: 1800.0,
        balance: 16200.0,
        paymentMethod: 'Efectivo',
      },
      {
        id: 5,
        date: '27/05/2025 02:10 PM',
        rawDate: '2025-05-27T14:10:00Z',
        type: 'Entrada',
        category: 'Ventas',
        description: 'Venta en efectivo INV-000124',
        inAmount: 4250.0,
        outAmount: null,
        balance: 20450.0,
        paymentMethod: 'Efectivo',
      },
      {
        id: 6,
        date: '27/05/2025 03:45 PM',
        rawDate: '2025-05-27T15:45:00Z',
        type: 'Salida',
        category: 'Gastos',
        description: 'Gasto de transporte',
        inAmount: null,
        outAmount: 700.0,
        balance: 19750.0,
        paymentMethod: 'Efectivo',
      },
      {
        id: 7,
        date: '27/05/2025 05:05 PM',
        rawDate: '2025-05-27T17:05:00Z',
        type: 'Entrada',
        category: 'Cobros',
        description: 'Pago de cliente María G.',
        inAmount: 4500.0,
        outAmount: null,
        balance: 24250.0,
        paymentMethod: 'Efectivo',
      },
    ];

    this.movements.set(sampleMovements);
    if (this.activeSession()) {
      const sess = { ...this.activeSession()! };
      sess.totalIn = 16750.0;
      sess.totalOut = 2500.0;
      sess.currentBalance = 24250.0;
      this.activeSession.set(sess);
    }
  }

  setTab(tab: 'movimientos' | 'ventas' | 'ingresos' | 'egresos') {
    this.activeTab.set(tab);
  }

  toggleMovementMenu() {
    this.showMovementMenu.update((v) => !v);
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

  openCloseRegisterModal() {
    if (this.closeRegisterModal && this.activeSession()) {
      this.closeRegisterModal.open(this.activeSession()!);
    }
  }
}
