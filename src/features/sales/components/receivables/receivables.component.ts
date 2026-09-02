import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReceivableService,
  type ReceivableDto,
} from '../../services/receivable.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { ConfirmDialogService } from '../../../cuadreEnv/services/confirm-dialog.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { CreateReceivableModalComponent } from './create-receivable-modal.component';
import { ReceivableDetailModalComponent } from './receivable-detail-modal.component';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
import {
  ButtonDirective,
  ContainerComponent,
  SpinnerComponent,
} from '@coreui/angular';

@Component({
  selector: 'app-receivables',
  templateUrl: './receivables.component.html',
  styleUrls: ['./receivables.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ContainerComponent,
    ButtonDirective,
    SpinnerComponent,
    CreateReceivableModalComponent,
    ReceivableDetailModalComponent,
    ListPaginationComponent,
  ],
})
export class ReceivablesComponent implements OnInit {
  @ViewChild('createModal') createModal!: CreateReceivableModalComponent;
  @ViewChild('detailModal') detailModal!: ReceivableDetailModalComponent;

  readonly translationService = inject(TranslationService);
  private readonly receivableService = inject(ReceivableService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmService = inject(ConfirmDialogService);

  receivables = signal<ReceivableDto[]>([]);
  isLoading = signal<boolean>(false);

  // Tab Segment: 'pending' (Pendientes) vs 'paid' (Saldadas por completo)
  selectedTab = signal<'pending' | 'paid'>('pending');

  // Counts for tabs
  readonly pendingCount = computed(() =>
    this.receivables().filter((r) => r.pendingAmount > 0 && r.status !== 'Pagado').length,
  );

  readonly paidCount = computed(() =>
    this.receivables().filter((r) => r.pendingAmount <= 0 || r.status === 'Pagado').length,
  );

  // Filters & Search
  searchQuery = signal<string>('');
  selectedStatus = signal<string>('');
  selectedSort = signal<string>('newest');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = 6;

  // Modals state
  isCreateModalOpen = false;
  isDetailModalOpen = false;
  selectedReceivable: ReceivableDto | null = null;

  // Computed Filtered and Sorted Receivables
  readonly filteredReceivables = computed(() => {
    let list = [...this.receivables()];
    const tab = this.selectedTab();
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.selectedStatus();
    const sort = this.selectedSort();

    // 1. Tab filtering (Pendientes vs Saldadas por completo)
    if (tab === 'pending') {
      list = list.filter((r) => r.pendingAmount > 0 && r.status !== 'Pagado');
    } else {
      list = list.filter((r) => r.pendingAmount <= 0 || r.status === 'Pagado');
    }

    // 2. Search Query
    if (query) {
      list = list.filter(
        (r) =>
          r.customerName.toLowerCase().includes(query) ||
          r.invoiceNumber.toLowerCase().includes(query) ||
          (r.description && r.description.toLowerCase().includes(query)) ||
          (r.customerIdentification &&
            r.customerIdentification.toLowerCase().includes(query)),
      );
    }

    // 3. Status Filter (if specific status is chosen)
    if (status) {
      list = list.filter((r) => r.status === status);
    }

    // 4. Sorting
    list.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return (
            new Date(a.creationDate).getTime() -
            new Date(b.creationDate).getTime()
          );
        case 'amount-desc':
          return b.pendingAmount - a.pendingAmount;
        case 'amount-asc':
          return a.pendingAmount - b.pendingAmount;
        case 'name-asc':
          return a.customerName.localeCompare(b.customerName);
        case 'newest':
        default:
          return (
            new Date(b.creationDate).getTime() -
            new Date(a.creationDate).getTime()
          );
      }
    });

    return list;
  });

  // Paged slice for current page
  readonly pagedReceivables = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredReceivables().slice(start, start + this.pageSize);
  });

  ngOnInit() {
    this.loadReceivables();
  }

  setTab(tab: 'pending' | 'paid') {
    this.selectedTab.set(tab);
    this.currentPage.set(1);
  }

  async reopenReceivable(item: ReceivableDto) {
    const confirmed = await this.confirmService.confirm({
      title: '¿Reabrir cuenta por cobrar?',
      message: `¿Desea reactivar la cuenta por cobrar de "${item.customerName}" (${item.invoiceNumber}) para permitir nuevos ajustes o correcciones de saldo?`,
      confirmText: 'Sí, reactivar',
      variant: 'warning',
    });

    if (confirmed) {
      this.isLoading.set(true);
      try {
        const res = await this.receivableService.reopenReceivable(item.id);
        if (res.success) {
          this.notificationService.success(`Cuenta ${item.invoiceNumber} reactivada correctamente.`);
          await this.loadReceivables();
        }
      } catch (e: any) {
        this.notificationService.showApiError(e);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  async loadReceivables() {
    this.isLoading.set(true);
    try {
      const res = await this.receivableService.getReceivables();
      if (res.success && res.data) {
        this.receivables.set(res.data);
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  onSearchChange(event: any) {
    this.searchQuery.set(event.target.value);
    this.currentPage.set(1);
  }

  onStatusChange(event: any) {
    this.selectedStatus.set(event.target.value);
    this.currentPage.set(1);
  }

  onSortChange(event: any) {
    this.selectedSort.set(event.target.value);
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  openCreateModal() {
    this.isCreateModalOpen = true;
    setTimeout(() => {
      if (this.createModal) this.createModal.open();
    });
  }

  openDetailModal(item: ReceivableDto) {
    this.selectedReceivable = item;
    this.isDetailModalOpen = true;
    setTimeout(() => {
      if (this.detailModal) this.detailModal.open(item);
    });
  }

  async deleteReceivable(item: ReceivableDto) {
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar venta por cobrar?',
      message: `¿Estás seguro de que deseas eliminar la factura ${item.invoiceNumber} correspondiente a "${item.customerName}"? Esta acción no se puede deshacer.`,
      itemName: `${item.customerName} - ${item.invoiceNumber} (RD$ ${item.pendingAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })})`,
      itemType: 'Venta por Cobrar',
      confirmText: 'Eliminar Venta',
      variant: 'danger',
    });

    if (!confirmed) return;

    this.isLoading.set(true);
    try {
      const res = await this.receivableService.deleteReceivable(item.id);
      if (res.success) {
        this.notificationService.success(
          'Venta por cobrar eliminada exitosamente.',
        );
        this.loadReceivables();
      } else {
        this.notificationService.error(
          res.message || 'Error al eliminar la venta por cobrar.',
        );
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
