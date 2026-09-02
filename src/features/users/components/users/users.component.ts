import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { ConfirmDialogService } from '../../../cuadreEnv/services/confirm-dialog.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import type { UserDto } from '../../../cuadreEnv/types/api';
import { IconDirective } from '@coreui/icons-angular';
import { InviteModalComponent } from './invite-modal.component';
import {
  FilterPanelComponent,
  type FilterConfig,
  type FilterValues,
} from '../../../cuadreEnv/components/filter-panel/filter-panel.component';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ContainerComponent,
  AlertComponent,
  SpinnerComponent,
  FormSelectDirective,
} from '@coreui/angular';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
import { TableComponent } from '../../../cuadreEnv/components/table/table.component';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    TableComponent,
    ButtonDirective,
    IconDirective,
    AlertComponent,
    SpinnerComponent,
    FormSelectDirective,
    InviteModalComponent,
    FilterPanelComponent,
    ListPaginationComponent,
  ],
})
export class UsersComponent implements OnInit {
  @ViewChild('inviteModal') inviteModal!: InviteModalComponent;

  readonly translationService = inject(TranslationService);
  private confirmService = inject(ConfirmDialogService);

  users = signal<UserDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  filters = signal<FilterValues>({});
  currentPage = signal<number>(1);
  pageSize = 10;
  totalItems = signal<number>(0);

  readonly filterConfig = computed<FilterConfig[]>(() => [
    {
      key: 'search',
      label: this.translationService.t('users.filterSearch'),
      type: 'text',
      placeholder: this.translationService.t('users.filterSearch'),
    },
    {
      key: 'role',
      label: this.translationService.t('users.filterRole'),
      type: 'select',
      options: [
        { label: this.translationService.t('users.filterAll'), value: '' },
        { label: 'Admin', value: 'Admin' },
        { label: 'Manager', value: 'Manager' },
        { label: 'Employee', value: 'Employee' },
      ],
    },
    {
      key: 'status',
      label: this.translationService.t('users.filterStatus'),
      type: 'select',
      options: [
        { label: this.translationService.t('users.filterAll'), value: '' },
        {
          label: this.translationService.t('customers.filterActive'),
          value: 'active',
        },
        {
          label: this.translationService.t('customers.filterInactive'),
          value: 'inactive',
        },
      ],
    },
  ]);

  isModalOpen = false;

  get columns() {
    return [
      { field: 'id', label: this.translationService.t('users.table.userId') },
      { field: 'name', label: this.translationService.t('users.table.name') },
      { field: 'email', label: this.translationService.t('users.table.email') },
      { field: 'role', label: this.translationService.t('users.table.role') },
      {
        field: 'status',
        label: this.translationService.t('users.table.status'),
      },
      { field: 'actions', label: this.translationService.t('common.actions') },
    ];
  }

  constructor(
    private userService: UserService,
    public authService: AuthService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  async loadUsers() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const res = await this.userService.getUsers();
      if (res.success && res.data) {
        this.users.set(res.data);
        this.totalItems.set(this.getFilteredUsersCount());
      } else {
        this.errorMessage.set(res.message || 'Failed to load user list.');
      }
    } catch (e: any) {
      const mapped = this.notificationService.showApiError(e);
      this.errorMessage.set(mapped.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  onFiltersChange(values: FilterValues) {
    this.filters.set(values);
    this.currentPage.set(1);
    this.totalItems.set(this.getFilteredUsersCount());
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  readonly filteredUsersBase = computed(() => {
    const activeFilters = this.filters();
    const search = String((activeFilters['search'] as string | undefined) || '')
      .trim()
      .toLowerCase();
    const role = String(
      (activeFilters['role'] as string | undefined) || '',
    ).trim();
    const status = String(
      (activeFilters['status'] as string | undefined) || '',
    ).trim();

    return this.users().filter((user) => {
      const haystack = [
        user.firstName,
        user.lastName,
        user.email,
        user.identification,
        user.userName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesRole = !role || user.role === role;
      const matchesStatus =
        !status ||
        (status === 'active' && user.active !== false) ||
        (status === 'inactive' && user.active === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  });

  readonly filteredUsersCount = computed(() => this.filteredUsersBase().length);

  readonly pagedUsers = computed(() => {
    return this.filteredUsersBase().slice(
      (this.currentPage() - 1) * this.pageSize,
      this.currentPage() * this.pageSize,
    );
  });

  getFilteredUsersCount(): number {
    return this.filteredUsersCount();
  }

  getFilteredUsers(): UserDto[] {
    return this.pagedUsers();
  }

  openInviteModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.inviteModal) this.inviteModal.open();
    });
  }

  async toggleDeactivation(user: UserDto) {
    if (!user.id) return;
    const isDeactivating = user.active !== false;
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || `Usuario #${user.id}`;

    const confirmed = await this.confirmService.confirm({
      title: isDeactivating ? '¿Desactivar usuario?' : '¿Reactivar usuario?',
      message: isDeactivating
        ? 'El usuario no podrá iniciar sesión en la plataforma hasta que su cuenta sea reactivada.'
        : 'El usuario recuperará el acceso a la plataforma con su rol asignado.',
      itemName: userName,
      itemType: 'Usuario',
      confirmText: isDeactivating ? 'Desactivar' : 'Reactivar',
      variant: isDeactivating ? 'danger' : 'warning',
      icon: isDeactivating ? 'cilTrash' : 'cilWarning',
    });
    if (!confirmed) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      if (isDeactivating) {
        await this.userService.deactivateUser(user.id);
        this.notificationService.success('Usuario desactivado exitosamente.');
      } else {
        await this.userService.reactivateUser(user.id);
        this.notificationService.success('Usuario reactivado exitosamente.');
      }
      this.loadUsers();
    } catch (e: any) {
      const mapped = this.notificationService.showApiError(e);
      this.errorMessage.set(mapped.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  async changeUserRole(user: UserDto, event: any) {
    if (!user.id) return;
    const newRole = event.target.value;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.userService.changeRole(user.id, newRole);
      this.notificationService.success('Rol de usuario actualizado exitosamente.');
      this.loadUsers();
    } catch (e: any) {
      const mapped = this.notificationService.showApiError(e);
      this.errorMessage.set(mapped.message);
    } finally {
      this.isLoading.set(false);
    }
  }
}

