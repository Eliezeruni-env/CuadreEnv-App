import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CashRegisterService } from '../../services/cash-register.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import type { CashRegisterDto, CashMovementDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import { CashRegisterModalComponent } from './cash-register-modal.component';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  RowComponent,
  TableDirective,
  AlertComponent,
  SpinnerComponent,
  NavComponent,
  NavItemComponent,
  NavLinkDirective
} from '@coreui/angular';

@Component({
  selector: 'app-cash-register',
  templateUrl: './cash-register.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    TableDirective,
    ButtonDirective,
    IconDirective,
    AlertComponent,
    SpinnerComponent,
    NavComponent,
    NavItemComponent,
    NavLinkDirective,
    CashRegisterModalComponent
  ]
})
export class CashRegisterComponent implements OnInit {
  @ViewChild('registerModal') registerModal!: CashRegisterModalComponent;

  activeTab = signal<string>('registers');
  registers = signal<CashRegisterDto[]>([]);
  movements = signal<CashMovementDto[]>([]);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  isModalOpen = false;

  constructor(
    private cashRegisterService: CashRegisterService,
    public authService: AuthService
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
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error loading cash registers data.');
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
    const r = this.registers().find(item => item.id === id);
    return r ? r.name : `Register #${id}`;
  }
}
