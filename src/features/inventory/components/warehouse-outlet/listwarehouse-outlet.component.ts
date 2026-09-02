import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WarehouseOutletService } from '../../services/warehouse-outlet.service';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
import type { WarehouseOutlet } from '../../../../app/models/movement';

@Component({
  selector: 'app-listwarehouse-outlet',
  standalone: true,
  imports: [CommonModule, FormsModule, ListPaginationComponent],
  templateUrl: './listwarehouse-outlet.component.html',
  styleUrls: ['./listwarehouse-outlet.component.scss'],
})
export class ListwarehouseOutletComponent implements OnInit {
  private outletService = inject(WarehouseOutletService);
  private router = inject(Router);

  outlets = signal<WarehouseOutlet[]>([]);
  isLoading = signal<boolean>(false);
  searchTerm = '';

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  selectedOutlet: WarehouseOutlet | null = null;

  readonly filteredOutlets = computed(() => {
    const q = this.searchTerm.toLowerCase().trim();
    if (!q) return this.outlets();
    return this.outlets().filter(
      (o) =>
        (o.movementNumber || '').toLowerCase().includes(q) ||
        (o.warehouseName || '').toLowerCase().includes(q) ||
        (o.conceptName || '').toLowerCase().includes(q) ||
        (o.commentary || '').toLowerCase().includes(q),
    );
  });

  readonly pagedOutlets = computed(() => {
    const list = this.filteredOutlets();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.loadOutlets();
  }

  async loadOutlets() {
    this.isLoading.set(true);
    try {
      const res = await this.outletService.getOutlets();
      if (res?.success && res.data) {
        this.outlets.set(res.data);
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
    this.router.navigate(['/inventory/outlets/create']);
  }

  viewDetail(outlet: WarehouseOutlet) {
    this.selectedOutlet = outlet;
  }

  printVoucher() {
    window.print();
  }
}
