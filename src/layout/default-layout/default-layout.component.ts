import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import { CommonModule } from '@angular/common';

import { IconDirective } from '@coreui/icons-angular';
import {
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective,
  ToasterComponent,
  ToastComponent,
  ToastHeaderComponent,
  ToastBodyComponent,
} from '@coreui/angular';

import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { navItems as staticNavItems } from './_nav';
import { NotificationService } from '../../features/cuadreEnv/services/notification.service';
import { TranslationService } from '../../features/cuadreEnv/services/translation.service';
import { ConfirmDialogComponent } from '../../features/cuadreEnv/components/confirm-dialog/confirm-dialog.component';

import { AuthService } from '../../features/cuadreEnv/services/auth.service';
import { PermissionService } from '../../features/roles/services/permission.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarBrandComponent,
    SidebarNavComponent,
    SidebarFooterComponent,
    SidebarToggleDirective,
    SidebarTogglerDirective,
    ContainerComponent,
    DefaultFooterComponent,
    DefaultHeaderComponent,
    IconDirective,
    NgScrollbar,
    RouterOutlet,
    RouterLink,
    ShadowOnScrollDirective,
    ToasterComponent,
    ToastComponent,
    ToastHeaderComponent,
    ToastBodyComponent,
    ConfirmDialogComponent,
  ],
})
export class DefaultLayoutComponent {
  private readonly translationService = inject(TranslationService);
  public notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);

  public readonly navItems = computed(() => {
    const translated = this.translationService.getTranslatedNavItems(staticNavItems);
    const isAdmin =
      this.authService.isSuperUser() ||
      this.authService.hasRole(['Admin', 'SuperUser', 'SuperAdmin', 'SysAdmin']);
    const isPrivileged =
      isAdmin ||
      this.authService.hasRole(['Auditor', 'Audit', 'Supervisor', 'Manager']);

    return translated.filter((item) => {
      const url = typeof item.url === 'string' ? item.url : (Array.isArray(item.url) ? item.url.join('/') : '');
      if (url === '/metrics' || url.startsWith('/metrics')) {
        return isPrivileged;
      }
      if (url === '/users' || url.startsWith('/users')) {
        return isAdmin || this.permissionService.hasPermission('Company', 'View');
      }
      if (url.includes('/admin/roles')) {
        return isAdmin;
      }
      if (url.includes('/admin/approvals')) {
        return isPrivileged || this.permissionService.hasPermission('Audit', 'View');
      }
      if (url.includes('/company/settings')) {
        return isAdmin;
      }
      return true;
    });
  });
}
