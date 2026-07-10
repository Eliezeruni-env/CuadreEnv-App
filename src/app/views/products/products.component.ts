import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import type { ProductDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import { ProductModalComponent } from './product-modal.component';
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
  PaginationComponent,
  PageItemDirective,
  PageLinkDirective
} from '@coreui/angular';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
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
    PaginationComponent,
    PageItemDirective,
    PageLinkDirective,
    ProductModalComponent
  ]
})
export class ProductsComponent implements OnInit {
  @ViewChild('productModal') productModal!: ProductModalComponent;

  products = signal<ProductDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Pagination
  currentPage = signal<number>(1);
  pageSize = 10;
  totalItems = signal<number>(0);

  isModalOpen = false;

  constructor(
    private productService: ProductService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadProducts();
  }

  async loadProducts() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const res = await this.productService.getPagedProducts(this.currentPage(), this.pageSize);
      if (res.success && res.data) {
        this.products.set(res.data.items || []);
        this.totalItems.set(res.data.total || 0);
      } else {
        this.errorMessage.set(res.message || 'Failed to load products catalogue.');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error loading products.');
    } finally {
      this.isLoading.set(false);
    }
  }

  onPageChange(page: number) {
    if (page < 1 || page * this.pageSize - this.pageSize >= this.totalItems()) return;
    this.currentPage.set(page);
    this.loadProducts();
  }

  openCreateModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.productModal) this.productModal.openCreate();
    });
  }

  openEditModal(product: ProductDto) {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.productModal) this.productModal.openEdit(product);
    });
  }
}
