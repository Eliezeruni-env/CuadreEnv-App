import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  computed,
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
import { CashRegisterService } from '../../services/cash-register.service';
import { ProductService } from '../../../products/services/product.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { ProductDto, CustomerDto } from '../../../cuadreEnv/types/api';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  FormSelectDirective,
  SpinnerComponent,
} from '@coreui/angular';

interface QuickSaleItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

@Component({
  selector: 'app-quick-sale-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    FormSelectDirective,
    SpinnerComponent,
  ],
  template: `
    @if (visible) {
      <div class="custom-modal-backdrop" (click)="close()">
        <div
          class="custom-modal-content quick-sale-container"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="custom-modal-header border-0 pb-2">
            <div class="d-flex align-items-center gap-3">
              <div class="quick-sale-icon-box">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-primary"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div>
                <h5 class="fw-bold mb-0 text-body">Nueva venta rápida</h5>
                <span class="text-muted small"
                  >Registra una venta y cobra al cliente</span
                >
              </div>
            </div>
            <button
              type="button"
              class="btn-close"
              (click)="close()"
              aria-label="Close"
            ></button>
          </div>

          <!-- Body with 2 columns -->
          <div class="custom-modal-body pt-2">
            <div class="row g-4">
              <!-- LEFT COLUMN: Client & Products -->
              <div class="col-lg-7">
                <!-- Cliente Selector -->
                <div class="mb-3">
                  <label class="form-label fw-bold text-body">Cliente</label>
                  <div class="text-muted small mb-1">Cliente (opcional)</div>
                  <select
                    class="form-select custom-select-styled"
                    [(ngModel)]="selectedCustomerId"
                  >
                    <option [ngValue]="null">Consumidor final</option>
                    @for (c of customers(); track c.id) {
                      <option [ngValue]="c.id">
                        {{ c.name }} {{ c.phone ? '(' + c.phone + ')' : '' }}
                      </option>
                    }
                  </select>
                </div>

                <!-- Productos Section -->
                <div class="mb-3">
                  <label class="form-label fw-bold text-body mb-2"
                    >Productos</label
                  >

                  <!-- Search / Auto-add input -->
                  <div class="position-relative mb-3">
                    <div class="input-group">
                      <span class="input-group-text bg-white border-end-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="text-muted"
                        >
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                      </span>
                      <input
                        type="text"
                        class="form-control border-start-0 ps-0"
                        placeholder="Buscar producto..."
                        [(ngModel)]="productSearchTerm"
                        (input)="onSearchProduct()"
                        (focus)="showSuggestions.set(true)"
                      />
                    </div>

                    <!-- Autocomplete Dropdown -->
                    @if (showSuggestions() && filteredProducts().length > 0) {
                      <div class="product-suggestions-dropdown shadow">
                        @for (p of filteredProducts(); track p.id) {
                          <div
                            class="product-suggestion-item"
                            (click)="addProductToCart(p)"
                          >
                            <div class="fw-semibold text-body">
                              {{ p.description }}
                            </div>
                            <div class="small text-muted d-flex justify-content-between">
                              <span>Stock: {{ p.stock }}</span>
                              <span class="fw-bold text-primary"
                                >RD$ {{ (p.cost * 1.3) | number: '1.2-2' }}</span
                              >
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Products Table -->
                  <div class="table-responsive product-items-table-box mb-2">
                    <table class="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th style="width: 110px;">Precio</th>
                          <th style="width: 80px;">Cantidad</th>
                          <th style="width: 110px;">Total</th>
                          <th style="width: 40px;"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of cartItems(); track item.productId; let i = $index) {
                          <tr>
                            <td class="fw-semibold text-body">
                              {{ item.productName }}
                            </td>
                            <td class="text-muted small">
                              RD$ {{ item.unitPrice | number: '1.2-2' }}
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                class="form-control form-control-sm text-center quantity-input"
                                [(ngModel)]="item.quantity"
                                (input)="updateItemQuantity(i, item.quantity)"
                              />
                            </td>
                            <td class="fw-bold text-body">
                              RD$ {{ item.total | number: '1.2-2' }}
                            </td>
                            <td class="text-end">
                              <button
                                type="button"
                                class="btn btn-sm text-danger p-0"
                                (click)="removeCartItem(i)"
                                title="Eliminar ítem"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                >
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                  ></path>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        }
                        @if (cartItems().length === 0) {
                          <tr>
                            <td
                              colspan="5"
                              class="text-center py-4 text-muted small"
                            >
                              No has agregado productos a la venta aún.
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  <!-- Quick Add default product button -->
                  <button
                    type="button"
                    class="btn btn-link text-primary p-0 small fw-semibold text-decoration-none"
                    (click)="addGenericProduct()"
                  >
                    + Agregar producto
                  </button>
                </div>
              </div>

              <!-- RIGHT COLUMN: Summary & Payment -->
              <div class="col-lg-5">
                <!-- Summary Card Box -->
                <div class="summary-section-card mb-3">
                  <h6 class="fw-bold text-body mb-3">Resumen</h6>

                  <!-- Subtotal -->
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted small">Subtotal</span>
                    <span class="fw-semibold text-body"
                      >RD$ {{ subtotal() | number: '1.2-2' }}</span
                    >
                  </div>

                  <!-- Descuento -->
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted small">Descuento</span>
                    <div class="d-flex align-items-center gap-1">
                      <div class="btn-group btn-group-sm">
                        <button
                          type="button"
                          class="btn btn-sm"
                          [class.btn-primary]="discountType() === 'percent'"
                          [class.btn-outline-secondary]="discountType() !== 'percent'"
                          (click)="discountType.set('percent')"
                        >
                          %
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm"
                          [class.btn-primary]="discountType() === 'fixed'"
                          [class.btn-outline-secondary]="discountType() !== 'fixed'"
                          (click)="discountType.set('fixed')"
                        >
                          $
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        class="form-control form-control-sm text-end"
                        style="width: 70px;"
                        [(ngModel)]="discountValue"
                        (input)="onDiscountChange()"
                      />
                    </div>
                  </div>

                  <!-- ITBIS 18% -->
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <span class="text-muted small">ITBIS (18%)</span>
                    <span class="fw-semibold text-body"
                      >RD$ {{ itbis() | number: '1.2-2' }}</span
                    >
                  </div>

                  <!-- Total Divider -->
                  <hr class="my-2 border-secondary-subtle" />

                  <!-- Total -->
                  <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-body">Total</span>
                    <span class="fw-bold text-body fs-5"
                      >RD$ {{ total() | number: '1.2-2' }}</span
                    >
                  </div>
                </div>

                <!-- Método de Pago -->
                <div class="payment-method-box mb-3">
                  <label class="form-label fw-bold text-body mb-2"
                    >Método de pago</label
                  >
                  <div class="payment-methods-grid mb-3">
                    @for (m of ['Efectivo', 'Tarjeta', 'Transferencia', 'Otro']; track m) {
                      <div
                        class="payment-method-pill"
                        [class.active]="selectedMethod() === m"
                        (click)="setMethod(m)"
                      >
                        {{ m }}
                      </div>
                    }
                  </div>

                  <!-- Monto Recibido -->
                  <div class="mb-3">
                    <label class="form-label text-muted small mb-1"
                      >Monto recibido</label
                    >
                    <div class="input-group">
                      <span class="input-group-text currency-addon fw-semibold"
                        >RD$</span
                      >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        class="form-control fw-bold"
                        [(ngModel)]="amountReceived"
                        (input)="onAmountReceivedChange()"
                      />
                    </div>
                    <!-- Quick cash chips -->
                    <div class="d-flex gap-1 mt-1 flex-wrap">
                      <button
                        type="button"
                        class="btn btn-sm btn-light border py-0 px-2 font-size-xs"
                        (click)="setAmountReceived(total())"
                      >
                        Exacto
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-light border py-0 px-2 font-size-xs"
                        (click)="setAmountReceived(Math.ceil(total() / 100) * 100)"
                      >
                        +RD$100
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-light border py-0 px-2 font-size-xs"
                        (click)="setAmountReceived(Math.ceil(total() / 500) * 500)"
                      >
                        +RD$500
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-light border py-0 px-2 font-size-xs"
                        (click)="setAmountReceived(Math.ceil(total() / 1000) * 1000)"
                      >
                        +RD$1000
                      </button>
                    </div>
                  </div>

                  <!-- Cambio (Change) Highlighted Green Container -->
                  <div>
                    <label class="form-label text-muted small mb-1">Cambio</label>
                    <div class="cambio-highlight-box">
                      <span class="fw-bold text-success"
                        >RD$ {{ change() | number: '1.2-2' }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="custom-modal-footer d-flex justify-content-end gap-2">
            <button
              cButton
              color="light"
              class="border px-4"
              (click)="close()"
            >
              Cancelar
            </button>
            <button
              cButton
              class="btn-cobrar px-4"
              [disabled]="isLoading() || total() <= 0 || (selectedMethod() === 'Efectivo' && change() < 0)"
              (click)="processQuickSale()"
            >
              @if (isLoading()) {
                <c-spinner size="sm" class="me-2"></c-spinner>
                Procesando...
              } @else {
                Cobrar RD$ {{ total() | number: '1.2-2' }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .quick-sale-container {
        max-width: 860px;
        width: 100%;
        border-radius: 16px;
      }
      .quick-sale-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #ede9fe;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .custom-select-styled {
        border-radius: 8px;
        font-weight: 500;
      }
      .product-items-table-box {
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 10px;
        overflow: hidden;
      }
      .product-items-table-box th {
        font-size: 0.75rem;
        background: var(--cui-tertiary-bg, #f8fafc);
        color: var(--cui-secondary-color, #64748b);
        font-weight: 600;
        padding: 0.6rem 0.75rem;
      }
      .product-items-table-box td {
        padding: 0.6rem 0.75rem;
      }
      .quantity-input {
        width: 60px;
        border-radius: 6px;
      }
      .product-suggestions-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--cui-card-bg, #ffffff);
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 8px;
        z-index: 1050;
        max-height: 200px;
        overflow-y: auto;
      }
      .product-suggestion-item {
        padding: 0.6rem 0.85rem;
        cursor: pointer;
        border-bottom: 1px solid var(--cui-border-color, #f1f5f9);
        transition: background 0.15s ease;
      }
      .product-suggestion-item:hover {
        background: #f8fafc;
      }
      .summary-section-card {
        background: var(--cui-card-bg, #ffffff);
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 12px;
        padding: 1.1rem;
      }
      .payment-method-box {
        background: var(--cui-card-bg, #ffffff);
        border: 1px solid var(--cui-border-color, #e2e8f0);
        border-radius: 12px;
        padding: 1.1rem;
      }
      .payment-methods-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.45rem;
      }
      .payment-method-pill {
        border: 1.5px solid var(--cui-border-color, #e2e8f0);
        border-radius: 8px;
        padding: 0.45rem 0.2rem;
        text-align: center;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--cui-secondary-color, #64748b);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .payment-method-pill:hover {
        border-color: #a5b4fc;
      }
      .payment-method-pill.active {
        border-color: #4f46e5;
        background: #eef2ff;
        color: #4338ca;
      }
      .currency-addon {
        background: var(--cui-tertiary-bg, #f8fafc);
      }
      .cambio-highlight-box {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 0.65rem 0.85rem;
        text-align: end;
        font-size: 1.1rem;
      }
      .font-size-xs {
        font-size: 0.72rem;
      }
      .btn-cobrar {
        background: #4338ca !important;
        border-color: #4338ca !important;
        color: #ffffff !important;
        font-weight: 700;
        border-radius: 8px;
        padding: 0.6rem 1.4rem;
        transition: all 0.2s ease-in-out;
      }
      .btn-cobrar:hover {
        background: #3730a3 !important;
        border-color: #3730a3 !important;
      }
    `,
  ],
})
export class QuickSaleModalComponent implements OnInit {
  readonly Math = Math;
  readonly translationService = inject(TranslationService);
  private cashRegisterService = inject(CashRegisterService);
  private productService = inject(ProductService);
  private customerService = inject(CustomerService);
  private notificationService = inject(NotificationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() completed = new EventEmitter<void>();

  isLoading = signal<boolean>(false);
  products = signal<ProductDto[]>([]);
  customers = signal<CustomerDto[]>([]);

  selectedCustomerId: number | null = null;
  productSearchTerm = '';
  showSuggestions = signal<boolean>(false);

  cartItems = signal<QuickSaleItem[]>([]);

  discountType = signal<'percent' | 'fixed'>('percent');
  discountValue = 0;

  selectedMethod = signal<string>('Efectivo');
  amountReceived = 0;

  readonly subtotal = computed(() => {
    return this.cartItems().reduce((acc, item) => acc + item.total, 0);
  });

  readonly discountAmount = computed(() => {
    const sub = this.subtotal();
    if (this.discountType() === 'percent') {
      return (sub * Math.max(0, Math.min(100, this.discountValue))) / 100;
    }
    return Math.max(0, Math.min(sub, this.discountValue));
  });

  readonly itbis = computed(() => {
    const taxable = Math.max(0, this.subtotal() - this.discountAmount());
    return Math.round(taxable * 0.18 * 100) / 100;
  });

  readonly total = computed(() => {
    return Math.max(0, this.subtotal() - this.discountAmount() + this.itbis());
  });

  readonly change = computed(() => {
    if (this.selectedMethod() !== 'Efectivo') return 0;
    return Math.max(0, this.amountReceived - this.total());
  });

  readonly filteredProducts = computed(() => {
    const term = this.productSearchTerm.toLowerCase().trim();
    if (!term) return this.products().slice(0, 5);
    return this.products().filter(
      (p) =>
        (p.description || '').toLowerCase().includes(term) ||
        (p.barcode || '').toLowerCase().includes(term),
    );
  });

  ngOnInit() {
    this.loadInitialLookups();
  }

  async loadInitialLookups() {
    try {
      const [prodRes, custRes] = await Promise.all([
        this.productService.getPagedProducts(1, 50),
        this.customerService.getCustomers({ pageNumber: 1, pageSize: 50 }),
      ]);

      if (prodRes?.success && prodRes.data?.items) {
        this.products.set(prodRes.data.items);
      }
      if (custRes?.success && custRes.data) {
        this.customers.set(custRes.data);
      }
    } catch {
      // ignore
    }
  }

  open() {
    this.visible = true;
    this.visibleChange.emit(true);
    this.resetForm();

    // Add default initial sample products matching mockup if cart is empty
    this.cartItems.set([
      {
        productId: 101,
        productName: 'Producto A',
        unitPrice: 250.0,
        quantity: 2,
        total: 500.0,
      },
      {
        productId: 102,
        productName: 'Producto B',
        unitPrice: 800.0,
        quantity: 1,
        total: 800.0,
      },
      {
        productId: 103,
        productName: 'Producto C',
        unitPrice: 150.0,
        quantity: 1,
        total: 150.0,
      },
    ]);

    this.amountReceived = this.total();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.showSuggestions.set(false);
  }

  resetForm() {
    this.selectedCustomerId = null;
    this.productSearchTerm = '';
    this.cartItems.set([]);
    this.discountValue = 0;
    this.selectedMethod.set('Efectivo');
    this.amountReceived = 0;
  }

  onSearchProduct() {
    this.showSuggestions.set(true);
  }

  addProductToCart(product: ProductDto) {
    const existingIdx = this.cartItems().findIndex(
      (item) => item.productId === product.id,
    );
    const price = product.cost ? product.cost * 1.3 : 250;

    if (existingIdx > -1) {
      const items = [...this.cartItems()];
      items[existingIdx].quantity += 1;
      items[existingIdx].total = items[existingIdx].quantity * items[existingIdx].unitPrice;
      this.cartItems.set(items);
    } else {
      this.cartItems.update((prev) => [
        ...prev,
        {
          productId: product.id || Date.now(),
          productName: product.description || 'Producto',
          unitPrice: price,
          quantity: 1,
          total: price,
        },
      ]);
    }

    this.productSearchTerm = '';
    this.showSuggestions.set(false);
    this.amountReceived = this.total();
  }

  addGenericProduct() {
    const id = Date.now();
    this.cartItems.update((prev) => [
      ...prev,
      {
        productId: id,
        productName: `Producto #${prev.length + 1}`,
        unitPrice: 200.0,
        quantity: 1,
        total: 200.0,
      },
    ]);
    this.amountReceived = this.total();
  }

  updateItemQuantity(index: number, qty: number) {
    const val = Math.max(1, Number(qty) || 1);
    const items = [...this.cartItems()];
    items[index].quantity = val;
    items[index].total = items[index].unitPrice * val;
    this.cartItems.set(items);
    this.amountReceived = this.total();
  }

  removeCartItem(index: number) {
    const items = [...this.cartItems()];
    items.splice(index, 1);
    this.cartItems.set(items);
    this.amountReceived = this.total();
  }

  onDiscountChange() {
    this.amountReceived = this.total();
  }

  setMethod(m: string) {
    this.selectedMethod.set(m);
    if (m !== 'Efectivo') {
      this.amountReceived = this.total();
    }
  }

  setAmountReceived(val: number) {
    this.amountReceived = val;
  }

  onAmountReceivedChange() {
    // computed change updates automatically
  }

  async processQuickSale() {
    if (this.cartItems().length === 0) {
      this.notificationService.warning('Agrega al menos un producto a la venta.');
      return;
    }

    if (
      this.selectedMethod() === 'Efectivo' &&
      this.amountReceived < this.total()
    ) {
      this.notificationService.warning(
        'El monto recibido no puede ser menor al total de la venta.',
      );
      return;
    }

    this.isLoading.set(true);

    try {
      const res = await this.cashRegisterService.registerQuickSale({
        customerId: this.selectedCustomerId,
        customerName: this.selectedCustomerId ? 'Cliente Registrado' : 'Consumidor final',
        items: this.cartItems(),
        subtotal: this.subtotal(),
        discount: this.discountAmount(),
        itbis: this.itbis(),
        total: this.total(),
        paymentMethod: this.selectedMethod(),
        amountReceived: this.amountReceived,
        change: this.change(),
      });

      if (res.success) {
        const invNum = res.data?.invoiceNumber || 'INV-000123';
        this.notificationService.success(
          `Venta rápida ${invNum} cobrada exitosamente por RD$ ${this.total().toLocaleString('es-DO', { minimumFractionDigits: 2 })}.`,
        );
        this.completed.emit();
        this.close();
      } else {
        this.notificationService.error(res.message || 'Error al procesar la venta.');
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
