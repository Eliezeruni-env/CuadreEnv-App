import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CustomerService } from '../../../customers/services/customer.service';
import { ReceivableService } from '../../services/receivable.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { CustomerDto } from '../../../cuadreEnv/types/api';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  FormSelectDirective,
  SpinnerComponent,
} from '@coreui/angular';

@Component({
  selector: 'app-create-receivable-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    FormSelectDirective,
    SpinnerComponent,
  ],
  templateUrl: './create-receivable-modal.component.html',
  styleUrls: ['./create-receivable-modal.component.scss'],
})
export class CreateReceivableModalComponent implements OnInit {
  readonly translationService = inject(TranslationService);
  private readonly customerService = inject(CustomerService);
  private readonly receivableService = inject(ReceivableService);
  private readonly notificationService = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  customers = signal<CustomerDto[]>([]);
  isLoading = signal<boolean>(false);
  isQuickCustomer = signal<boolean>(false);

  receivableForm: FormGroup;

  constructor() {
    const today = new Date().toISOString().split('T')[0];
    this.receivableForm = this.fb.group({
      customerId: [''],
      quickCustomerName: [''],
      customerPhone: [''],
      customerEmail: [''],
      description: ['', [Validators.required]],
      totalAmount: [0, [Validators.required, Validators.min(0.01)]],
      installmentAmount: [0, [Validators.required, Validators.min(0.01)]],
      totalInstallments: [1, [Validators.required, Validators.min(1)]],
      startDate: [today, [Validators.required]],
      frequency: ['Quincenal', [Validators.required]],
    });
  }

  ngOnInit() {
    this.loadCustomers();
  }

  async loadCustomers() {
    try {
      const res = await this.customerService.getCustomers({
        pageNumber: 1,
        pageSize: 500,
        PageNumber: 1,
        PageSize: 500,
      } as any);
      if (res.success && res.data) {
        this.customers.set(res.data);
      }
    } catch (e: any) {
      console.error('Error loading customers:', e);
    }
  }

  open() {
    this.visible = true;
    this.visibleChange.emit(true);
    this.loadCustomers();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.resetForm();
  }

  resetForm() {
    const today = new Date().toISOString().split('T')[0];
    this.isQuickCustomer.set(false);
    this.receivableForm.reset({
      customerId: '',
      quickCustomerName: '',
      customerPhone: '',
      customerEmail: '',
      description: '',
      totalAmount: 0,
      installmentAmount: 0,
      totalInstallments: 1,
      startDate: today,
      frequency: 'Quincenal',
    });
  }

  toggleQuickCustomer() {
    this.isQuickCustomer.update((v) => !v);
    if (this.isQuickCustomer()) {
      this.receivableForm.patchValue({ customerId: '' });
    }
  }

  onCustomerSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const cId = Number(select.value);
    if (!cId) return;

    const customer = this.customers().find((c) => c.id === cId);
    if (customer) {
      this.receivableForm.patchValue({
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
      });
    }
  }

  calculateInstallments() {
    const total = parseFloat(this.receivableForm.get('totalAmount')?.value) || 0;
    const installments =
      parseInt(this.receivableForm.get('totalInstallments')?.value, 10) || 1;

    if (total > 0 && installments > 0) {
      const perInstallment = (total / installments).toFixed(2);
      this.receivableForm.patchValue(
        { installmentAmount: parseFloat(perInstallment) },
        { emitEvent: false },
      );
    }
  }

  async saveReceivable() {
    if (this.receivableForm.invalid) {
      this.receivableForm.markAllAsTouched();
      return;
    }

    const val = this.receivableForm.value;
    let customerName = 'Cliente General';
    let customerId = val.customerId ? Number(val.customerId) : undefined;

    if (this.isQuickCustomer() && val.quickCustomerName) {
      customerName = val.quickCustomerName;
    } else if (customerId) {
      const c = this.customers().find((item) => item.id === customerId);
      if (c) customerName = c.name;
    }

    this.isLoading.set(true);

    try {
      const res = await this.receivableService.createReceivable({
        customerId,
        customerName,
        customerPhone: val.customerPhone || null,
        customerEmail: val.customerEmail || null,
        description: val.description,
        totalAmount: parseFloat(val.totalAmount),
        totalInstallments: parseInt(val.totalInstallments, 10),
        installmentAmount: parseFloat(val.installmentAmount),
        startDate: val.startDate,
        frequency: val.frequency,
      });

      if (res.success) {
        this.notificationService.success(
          'Venta por cobrar creada exitosamente.',
        );
        this.saved.emit();
        this.close();
      } else {
        this.notificationService.error(
          res.message || 'Error al crear la venta por cobrar.',
        );
      }
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
