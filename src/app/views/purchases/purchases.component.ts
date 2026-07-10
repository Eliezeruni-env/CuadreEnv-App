import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchaseService } from '../../services/purchase.service';
import { AuthService } from '../../services/auth.service';
import type { PurchaseDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import { PurchaseModalComponent } from './purchase-modal.component';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  RowComponent,
  TableDirective,
  AlertComponent,
  SpinnerComponent
} from '@coreui/angular';

@Component({
  selector: 'app-purchases',
  templateUrl: './purchases.component.html',
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
    PurchaseModalComponent
  ]
})
export class PurchasesComponent implements OnInit {
  @ViewChild('purchaseModal') purchaseModal!: PurchaseModalComponent;

  purchases = signal<PurchaseDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  isModalOpen = false;
  selectedPurchase: PurchaseDto | null = null;

  constructor(
    private purchaseService: PurchaseService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const purRes = await this.purchaseService.getPurchases();
      if (purRes.success && purRes.data) {
        this.purchases.set(purRes.data);
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error loading purchases.');
    } finally {
      this.isLoading.set(false);
    }
  }

  openCreateModal() {
    this.selectedPurchase = null;
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.purchaseModal) this.purchaseModal.openCreate();
    });
  }

  viewPurchaseDetail(purchase: PurchaseDto) {
    this.selectedPurchase = purchase;
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.purchaseModal) this.purchaseModal.openDetail(purchase);
    });
  }
}
