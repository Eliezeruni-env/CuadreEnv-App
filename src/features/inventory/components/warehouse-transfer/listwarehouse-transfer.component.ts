import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WarehouseTransferService } from '../../services/warehouse-transfer.service';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
import type { WarehouseTransfer } from '../../../../app/models/movement';

@Component({
  selector: 'app-listwarehouse-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule, ListPaginationComponent],
  templateUrl: './listwarehouse-transfer.component.html',
  styleUrls: ['./listwarehouse-transfer.component.scss'],
})
export class ListwarehouseTransferComponent implements OnInit {
  private transferService = inject(WarehouseTransferService);
  private router = inject(Router);

  transfers = signal<WarehouseTransfer[]>([]);
  isLoading = signal<boolean>(false);
  searchTerm = '';

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  selectedTransfer: WarehouseTransfer | null = null;

  readonly filteredTransfers = computed(() => {
    const q = this.searchTerm.toLowerCase().trim();
    if (!q) return this.transfers();
    return this.transfers().filter(
      (t) =>
        (t.movementNumber || '').toLowerCase().includes(q) ||
        (t.warehouseOfOriginName || '').toLowerCase().includes(q) ||
        (t.destinationWarehouseName || '').toLowerCase().includes(q) ||
        (t.commentary || '').toLowerCase().includes(q),
    );
  });

  readonly pagedTransfers = computed(() => {
    const list = this.filteredTransfers();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.loadTransfers();
  }

  async loadTransfers() {
    this.isLoading.set(true);
    try {
      const res = await this.transferService.getTransfers();
      if (res?.success && res.data) {
        this.transfers.set(res.data);
      }
    } catch {
      // ignore
    } finally {
      this.isLoading.set(false);
    }
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  goToCreate() {
    this.router.navigate(['/inventory/transfers/create']);
  }

  viewDetail(transfer: WarehouseTransfer) {
    this.selectedTransfer = transfer;
  }

  printVoucher() {
    window.print();
  }
}
