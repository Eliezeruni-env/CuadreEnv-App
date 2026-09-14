import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SupplierService } from '../../services/supplier.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { ConfirmDialogService } from '../../../cuadreEnv/services/confirm-dialog.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import {
  ButtonDirective,
  ContainerComponent,
  AlertComponent,
  SpinnerComponent,
  FormControlDirective,
  FormDirective,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

export interface SupplierItem {
  id?: number;
  name: string;
  rnc?: string | null;
  cedula?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  active?: boolean;
}

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ContainerComponent,
    ButtonDirective,
    AlertComponent,
    SpinnerComponent,
    FormControlDirective,
    FormDirective,
    IconDirective,
  ],
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.scss'],
})
export class SuppliersComponent implements OnInit {
  readonly translationService = inject(TranslationService);
  private readonly supplierService = inject(SupplierService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);

  suppliers = signal<SupplierItem[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  searchTerm = signal<string>('');
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  selectedSupplierId = signal<number | null>(null);

  supplierForm: FormGroup;

  // Filtered suppliers
  readonly filteredSuppliers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.suppliers();
    if (!term) return list;
    return list.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.rnc || '').toLowerCase().includes(term) ||
        (s.cedula || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.contactPerson || '').toLowerCase().includes(term) ||
        (s.phone || '').toLowerCase().includes(term)
    );
  });

  readonly totalSuppliers = computed(() => this.suppliers().length);
  readonly activeSuppliersCount = computed(
    () => this.suppliers().filter((s) => s.active !== false).length
  );

  constructor() {
    this.supplierForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      rnc: ['', [Validators.maxLength(50)]],
      cedula: ['', [Validators.maxLength(50)]],
      phone: ['', [Validators.maxLength(50)]],
      mobile: ['', [Validators.maxLength(50)]],
      email: ['', [Validators.email, Validators.maxLength(100)]],
      address: ['', [Validators.maxLength(250)]],
      contactPerson: ['', [Validators.maxLength(100)]],
      active: [true],
    });
  }

  ngOnInit() {
    this.loadSuppliers();
  }

  async loadSuppliers() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const res = await this.supplierService.getSuppliers();
      if (res.success && res.data) {
        this.suppliers.set(res.data);
      } else {
        this.suppliers.set([]);
      }
    } catch (e: any) {
      this.errorMessage.set(
        e?.response?.data?.message || e?.message || 'Error al cargar los proveedores.'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  openCreateModal() {
    this.isEditMode.set(false);
    this.selectedSupplierId.set(null);
    this.supplierForm.reset({
      name: '',
      rnc: '',
      cedula: '',
      phone: '',
      mobile: '',
      email: '',
      address: '',
      contactPerson: '',
      active: true,
    });
    this.isModalOpen.set(true);
  }

  openEditModal(supplier: SupplierItem) {
    this.isEditMode.set(true);
    this.selectedSupplierId.set(supplier.id || null);
    this.supplierForm.patchValue({
      name: supplier.name || '',
      rnc: supplier.rnc || '',
      cedula: supplier.cedula || '',
      phone: supplier.phone || '',
      mobile: supplier.mobile || '',
      email: supplier.email || '',
      address: supplier.address || '',
      contactPerson: supplier.contactPerson || '',
      active: supplier.active !== false,
    });
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  async saveSupplier() {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const val = this.supplierForm.value;
    const payload: SupplierItem = {
      name: val.name.trim(),
      rnc: val.rnc ? val.rnc.trim() : null,
      cedula: val.cedula ? val.cedula.trim() : null,
      phone: val.phone ? val.phone.trim() : null,
      mobile: val.mobile ? val.mobile.trim() : null,
      email: val.email ? val.email.trim() : null,
      address: val.address ? val.address.trim() : null,
      contactPerson: val.contactPerson ? val.contactPerson.trim() : null,
      active: Boolean(val.active),
    };

    try {
      if (this.isEditMode() && this.selectedSupplierId()) {
        payload.id = this.selectedSupplierId()!;
        await this.supplierService.updateSupplier(payload);
        this.notificationService.success('Proveedor actualizado exitosamente.');
      } else {
        await this.supplierService.createSupplier(payload);
        this.notificationService.success('Proveedor creado exitosamente.');
      }
      this.closeModal();
      await this.loadSuppliers();
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteSupplier(supplier: SupplierItem) {
    if (!supplier.id) return;
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar Proveedor?',
      message: `¿Estás seguro de que deseas eliminar a "${supplier.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'danger',
    });

    if (!confirmed) return;

    this.isLoading.set(true);
    try {
      await this.supplierService.deleteSupplier(supplier.id);
      this.notificationService.success('Proveedor eliminado exitosamente.');
      await this.loadSuppliers();
    } catch (e: any) {
      this.notificationService.showApiError(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
