import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import type { UserDto } from '../../models/api';
import { IconDirective } from '@coreui/icons-angular';
import { InviteModalComponent } from './invite-modal.component';
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
  FormSelectDirective
} from '@coreui/angular';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
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
    FormSelectDirective,
    InviteModalComponent
  ]
})
export class UsersComponent implements OnInit {
  @ViewChild('inviteModal') inviteModal!: InviteModalComponent;

  users = signal<UserDto[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  isModalOpen = false;

  constructor(
    private userService: UserService,
    public authService: AuthService,
    private notificationService: NotificationService
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
      } else {
        this.errorMessage.set(res.message || 'Failed to load user list.');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Error fetching users list.');
    } finally {
      this.isLoading.set(false);
    }
  }

  openInviteModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.inviteModal) this.inviteModal.open();
    });
  }

  async toggleDeactivation(user: UserDto) {
    if (!user.id) return;
    const actionStr = user.active ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${actionStr} this user?`)) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      if (user.active) {
        await this.userService.deactivateUser(user.id);
        this.notificationService.success('User deactivated successfully!');
      } else {
        await this.userService.reactivateUser(user.id);
        this.notificationService.success('User reactivated successfully!');
      }
      this.loadUsers();
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || `Failed to ${actionStr} user.`);
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
      this.notificationService.success('User role updated successfully!');
      this.loadUsers();
    } catch (e: any) {
      this.errorMessage.set(e?.response?.data?.message || e?.message || 'Failed to update user role.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
