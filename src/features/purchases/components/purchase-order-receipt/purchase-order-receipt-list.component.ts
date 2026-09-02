import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PurchaseOrderReceiptService } from '../../services/purchase-order-receipt.service';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
import type { PurchaseOrderReceipt } from '../../../../app/models/purchase-order';

@Component({
  selector: 'app-purchase-order-receipt-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ListPaginationComponent],
  templateUrl: './purchase-order-receipt-list.component.html',
  styleUrls: ['./purchase-order-receipt-list.component.scss'],
})
export class PurchaseOrderReceiptListComponent implements OnInit {
  private receiptService = inject(PurchaseOrderReceiptService);
  private router = inject(Router);

  receipts = signal<PurchaseOrderReceipt[]>([]);
  isLoading = signal<boolean>(false);
  searchTerm = '';

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  selectedReceipt: PurchaseOrderReceipt | null = null;

  readonly filteredReceipts = computed(() => {
    const q = this.searchTerm.toLowerCase().trim();
    if (!q) return this.receipts();
    return this.receipts().filter(
      (r) =>
        r.receiptNumber.toLowerCase().includes(q) ||
        (r.purchaseOrderNumber && r.purchaseOrderNumber.toLowerCase().includes(q)) ||
        r.supplierName.toLowerCase().includes(q) ||
        (r.warehouseName && r.warehouseName.toLowerCase().includes(q)),
    );
  });

  readonly pagedReceipts = computed(() => {
    const list = this.filteredReceipts();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.loadReceipts();
  }

  async loadReceipts() {
    this.isLoading.set(true);
    try {
      const res = await this.receiptService.getReceipts();
      if (res?.success && res.data) {
        this.receipts.set(res.data);
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

  goToNewReceipt() {
    this.router.navigate(['/purchases/receipts/create']);
  }

  viewReceipt(receipt: PurchaseOrderReceipt) {
    this.selectedReceipt = receipt;
  }

  printVoucher() {
    window.print();
  }
}
