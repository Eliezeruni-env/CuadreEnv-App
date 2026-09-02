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
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
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
    SaleCompletedModalComponent,
    ListPaginationComponent,
  ],
})
export class CashRegisterComponent implements OnInit {
  readonly Math = Math;
  readonly translationService = inject(TranslationService);
  private readonly cashRegisterService = inject(CashRegisterService);
  private readonly notificationService = inject(NotificationService);
  public readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  @ViewChild('quickSaleModal') quickSaleModal!: QuickSaleModalComponent;
  @ViewChild('manualMovementModal') manualMovementModal!: ManualMovementModalComponent;
  @ViewChild('closeRegisterModal') closeRegisterModal!: CloseRegisterModalComponent;
  @ViewChild('saleCompletedModal') saleCompletedModal!: SaleCompletedModalComponent;

  activeSession = signal<CashRegisterSessionDto | null>(null);
  movements = signal<CashRegisterMovementItem[]>([]);
  sessionHistory = signal<CashRegisterSessionDto[]>([]);

  activeTab = signal<'movimientos' | 'ventas' | 'ingresos' | 'egresos'>('movimientos');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  showMovementMenu = signal<boolean>(false);

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
    this.openSessionForm = this.fb.group({
      initialAmount: [10000, [Validators.required, Validators.min(0)]],
      name: ['Caja Principal 01', [Validators.required]],
      cashierName: ['Administrador', [Validators.required]],
      notes: ['Fondo inicial para operaciones diarias'],
    });
  }

  ngOnInit() {
    this.loadData();
    this.route.queryParams.subscribe((params) => {
      if (params['requiresOpenSession']) {
        this.notificationService.warning(
          'Debes aperturar un turno de caja antes de realizar ventas o cobros.',
        );
      }
    });
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

  onQuickSaleCompleted(data: CompletedSaleDto) {
    this.lastCompletedSale = data;
    this.loadData();
    if (this.saleCompletedModal) {
      this.saleCompletedModal.open(data);
    } else {
      this.isSaleCompletedModalOpen = true;
    }
  }
}
