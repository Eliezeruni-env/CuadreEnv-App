import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';

export interface RouteInfo {
  path?: string;
  title: string;
  icon?: string;
  class?: string;
  badge?: string;
  badgeClass?: string;
  isTitle?: boolean;
  isExpanded?: boolean;
  children?: RouteInfo[];
}

export const ROUTES: RouteInfo[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    icon: 'cilSpeedometer',
    class: '',
  },
  {
    title: 'Operaciones Comerciales',
    isTitle: true,
  },
  {
    path: '/sales',
    title: 'Ventas y Facturación',
    icon: 'cilCart',
    class: '',
  },
  {
    path: '/cash-register',
    title: 'Caja y Cuadres',
    icon: 'cilCalculator',
    class: '',
  },
  {
    path: '/receivables',
    title: 'Cuentas por Cobrar',
    icon: 'cilDollar',
    class: '',
  },
  {
    path: '/customers',
    title: 'Clientes',
    icon: 'cilUser',
    class: '',
  },
  {
    title: 'Inventario & Catálogo',
    isTitle: true,
  },
  {
    path: '/inventory',
    title: 'Almacenes & Stock',
    icon: 'cilSwapHorizontal',
    class: '',
  },
  {
    title: 'Catálogo de Productos',
    icon: 'cilStorage',
    class: '',
    isExpanded: false,
    children: [
      {
        path: '/products',
        title: 'Listado de Productos',
      },
      {
        path: '/products/settings',
        title: 'Categorías y Tipos',
      },
    ],
  },
  {
    title: 'Contabilidad & Compras',
    isTitle: true,
  },
  {
    path: '/purchases',
    title: 'Compras a Proveedores',
    icon: 'cilTruck',
    class: '',
  },
  {
    path: '/payments',
    title: 'Pagos y Egresos',
    icon: 'cilCreditCard',
    class: '',
  },
  {
    title: 'Administración',
    isTitle: true,
  },
  {
    path: '/users',
    title: 'Usuarios y Permisos',
    icon: 'cilPeople',
    class: '',
  },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconDirective],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit {
  @Input() sidebarVisible = true;
  @Input() mobileOpen = false;
  @Output() closeMobileSidebar = new EventEmitter<void>();

  menuItems: RouteInfo[] = [];
  hoveredItem: RouteInfo | null = null;
  floatingTop = 0;
  private hoverTimeout: any;

  ngOnInit() {
    this.menuItems = ROUTES.map((item) => ({ ...item }));
  }

  toggleAccordion(item: RouteInfo) {
    if (!this.sidebarVisible) return;
    item.isExpanded = !item.isExpanded;
  }

  onItemMouseEnter(item: RouteInfo, event: MouseEvent) {
    if (this.sidebarVisible || !item.children || item.children.length === 0) {
      return;
    }
    clearTimeout(this.hoverTimeout);
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.floatingTop = rect.top;
    this.hoveredItem = item;
  }

  onItemMouseLeave() {
    if (this.sidebarVisible) return;
    this.hoverTimeout = setTimeout(() => {
      this.hoveredItem = null;
    }, 150);
  }

  cancelHoverLeave() {
    clearTimeout(this.hoverTimeout);
  }
}
