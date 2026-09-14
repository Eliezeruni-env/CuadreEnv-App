import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { CompanyService } from '../../../companies/services/company.service';
import { RoleService } from '../../../roles/services/role.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { PhoneMaskDirective, CedulaMaskDirective } from '../../../../app/shared/directives';
import type { UserDto, RoleDto } from '../../../cuadreEnv/types/api';

@Component({
  selector: 'app-employee-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PhoneMaskDirective, CedulaMaskDirective],
  templateUrl: './employee-modal.component.html',
  styleUrls: ['./employee-modal.component.scss'],
})
export class EmployeeModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private roleService = inject(RoleService);
  private notificationService = inject(NotificationService);
  readonly translationService = inject(TranslationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  isLoading = signal<boolean>(false);
  editingUserId = signal<number | null>(null);
  readonly activeCompanyName = computed(() => this.companyService.currentSettings().companyName || 'Mi Empresa');

  // Available roles dynamically loaded from the active company
  readonly companyRoles = computed(() => {
    const list = this.roleService.roles();
    // Exclude SuperAdmin/SuperUser
    return list.filter((r) => !['superadmin', 'superuser'].includes(r.name.toLowerCase()));
  });

  selectedRoles = signal<string[]>(['Cajero']);

  cvFileName = signal<string | null>(null);
  cvBase64 = signal<string | null>(null);
  idDocFileName = signal<string | null>(null);
  idDocBase64 = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    identification: ['', [Validators.required, Validators.minLength(11)]],
    phoneNumber: ['', [Validators.required, Validators.minLength(10)]],
    emergencyContact: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    void this.roleService.loadRoles();
  }

  toggleRole(roleName: string): void {
    const current = [...this.selectedRoles()];
    const idx = current.indexOf(roleName);
    if (idx >= 0) {
      if (current.length === 1) {
        this.notificationService.warning('El empleado debe tener al menos un rol asignado.');
        return;
      }
      current.splice(idx, 1);
    } else {
      current.push(roleName);
    }
    this.selectedRoles.set(current);
  }

  isRoleSelected(roleName: string): boolean {
    return this.selectedRoles().includes(roleName);
  }

  open(user?: UserDto) {
    if (user && user.id) {
      this.editingUserId.set(user.id);
      this.form.reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        identification: user.identification || '',
        phoneNumber: user.phoneNumber || '',
        emergencyContact: user.emergencyContact || '',
        email: user.email || '',
        password: '',
      });
      if (user.roles && user.roles.length > 0) {
        this.selectedRoles.set([...user.roles]);
      } else if (user.role) {
        this.selectedRoles.set([user.role]);
      } else {
        this.selectedRoles.set(['Cajero']);
      }
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.updateValueAndValidity();
    } else {
      this.editingUserId.set(null);
      this.form.reset({
        firstName: '',
        lastName: '',
        identification: '',
        phoneNumber: '',
        emergencyContact: '',
        email: '',
        password: '',
      });
      this.selectedRoles.set(['Cajero']);
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.get('password')?.updateValueAndValidity();
    }
    this.cvFileName.set(null);
    this.cvBase64.set(null);
    this.idDocFileName.set(null);
    this.idDocBase64.set(null);
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onCvSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.notificationService.error('El archivo de CV no debe exceder 5 MB.');
        return;
      }
      this.cvFileName.set(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        this.cvBase64.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  onIdDocSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.notificationService.error('El archivo del documento de cédula no debe exceder 5 MB.');
        return;
      }
      this.idDocFileName.set(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        this.idDocBase64.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notificationService.error('Por favor complete todos los campos obligatorios del formulario.');
      return;
    }

    if (this.selectedRoles().length === 0) {
      this.notificationService.error('Debe seleccionar al menos un rol para el colaborador.');
      return;
    }

    this.isLoading.set(true);
    try {
      const rawPhone = (this.form.value.phoneNumber || '').trim();
      const rawCedula = (this.form.value.identification || '').trim();
      const email = (this.form.value.email || '').trim().toLowerCase();
      const primaryRole = this.selectedRoles()[0] || 'Cajero';
      const allRoles = this.selectedRoles();

      const editId = this.editingUserId();
      if (editId) {
        await this.userService.updateUser(editId, {
          firstName: (this.form.value.firstName || '').trim(),
          lastName: (this.form.value.lastName || '').trim(),
          userName: email,
          role: primaryRole,
          roles: allRoles,
        } as any);
        this.notificationService.success('Empleado actualizado correctamente.');
      } else {
        const userPayload: UserDto = {
          firstName: (this.form.value.firstName || '').trim(),
          lastName: (this.form.value.lastName || '').trim(),
          userName: email,
          email: email,
          identification: rawCedula,
          phoneNumber: rawPhone,
          gender: 'M',
          role: primaryRole,
          roles: allRoles,
          active: true,
          password: this.form.value.password,
          emergencyContact: (this.form.value.emergencyContact || '').trim() || undefined,
        };

        await this.userService.createUser(userPayload);
        this.notificationService.success(`Empleado registrado e incorporado a ${this.activeCompanyName()} correctamente.`);
      }
      this.saved.emit();
      this.close();
    } catch (e: any) {
      let msg = 'Error al registrar el usuario.';
      if (e?.error?.errors && typeof e.error.errors === 'object') {
        const entries = Object.values(e.error.errors).flat();
        if (entries.length > 0) {
          msg = entries.join(' · ');
        }
      } else if (e?.error?.message) {
        msg = e.error.message;
      } else if (e?.error?.title) {
        msg = e.error.title;
      } else if (e?.message) {
        msg = e.message;
      }
      this.notificationService.error(msg);
    } finally {
      this.isLoading.set(false);
    }
  }
}
