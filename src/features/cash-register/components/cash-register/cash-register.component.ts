import { Component, OnInit, signal, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CashRegisterService } from '../../services/cash-register.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { CashRegisterDto, CashMovementDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { CashRegisterModalComponent } from './cash-register-modal.component';
import {
  SectionNavComponent,
  type SectionNavItem,
} from '../../../cuadreEnv/components/section-nav/section-nav.component';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ContainerComponent,
  AlertComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { TableComponent } from '../../../cuadreEnv/components/table/table.component';

@Component({
  selector: 'app-cash-register',
  templateUrl: './cash-register.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    TableComponent,
    ButtonDirective,
    IconDirective,
    AlertComponent,
    SpinnerComponent,
    CashRegisterModalComponent,
    SectionNavComponent,
  ],
})
export class CashRegisterComponent implements OnInit {
  @ViewChild('registerModal') registerModal!: CashRegisterModalComponent;
  readonly translationService = inject(TranslationService);

  activeTab = signal<string>('registers');
  registers = signal<CashRegisterDto[]>([]);
  movements = signal<CashMovementDto[]>([]);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  isModalOpen = false;

  get sectionItems(): SectionNavItem[] {
    return [
      { label: this.translationService.t('cashRegister.title'), value: 'registers', icon: 'cilCalculator' },
      { label: this.translationService.t('cashRegister.movementsTab'), value: 'movements', icon: 'cilList' },
    ];
  }


  constructor(
    private cashRegisterService: CashRegisterService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const regRes = await this.cashRegisterService.getCashRegisters();
      if (regRes.success && regRes.data) {
        this.registers.set(regRes.data);
      }

      const movRes = await this.cashRegisterService.getCashMovements();
      if (movRes.success && movRes.data) {
        this.movements.set(movRes.data);
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message ||
          e?.message ||
          'Error loading cash registers data.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  setTab(tabName: string) {
    this.activeTab.set(tabName);
    this.errorMessage.set(null);
  }

  openRegisterModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.registerModal) this.registerModal.openRegisterForm();
    });
  }

  openCloseModal(register: CashRegisterDto) {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.registerModal) this.registerModal.openCloseForm(register);
    });
  }

  openMovementModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.registerModal) this.registerModal.openMovementForm();
    });
  }

  getRegisterName(id: number): string {
    const r = this.registers().find((item) => item.id === id);
    return r ? r.name : `Register #${id}`;
  }
}
