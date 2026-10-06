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

    // 1. Filtrar enlaces individuales con base en los módulos permitidos por USM
    const filtered = translated.filter((item) => {
      if (item.title) return true;
      const url = typeof item.url === 'string' ? item.url : (Array.isArray(item.url) ? item.url.join('/') : '');
      return this.permissionService.hasModuleAccess(url);
    });

    // 2. Limpiar encabezados de sección huérfanos que quedaron sin módulos permitidos
    const finalItems: typeof translated = [];
    for (let i = 0; i < filtered.length; i++) {
      const current = filtered[i];
      if (current.title) {
        let hasChildren = false;
        for (let j = i + 1; j < filtered.length; j++) {
          if (filtered[j].title) break;
          hasChildren = true;
          break;
        }
        if (hasChildren) {
          finalItems.push(current);
        }
      } else {
        finalItems.push(current);
      }
    }

    return finalItems;
  });
}
