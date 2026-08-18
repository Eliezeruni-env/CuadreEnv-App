import { Component, inject } from '@angular/core';
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
  ToastBodyComponent
} from '@coreui/angular';

import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { navItems as staticNavItems } from './_nav';
import { NotificationService } from '../../features/cuadreEnv/services/notification.service';
import { TranslationService } from '../../features/cuadreEnv/services/translation.service';

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
    ToastBodyComponent
  ]
})
export class DefaultLayoutComponent {
  private readonly translationService = inject(TranslationService);
  public notificationService = inject(NotificationService);

  public get navItems() {
    return this.translationService.getTranslatedNavItems(staticNavItems);
  }
}

