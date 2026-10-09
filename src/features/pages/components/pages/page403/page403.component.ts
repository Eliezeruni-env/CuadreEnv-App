import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { AuthService } from '../../../../cuadreEnv/services/auth.service';

@Component({
  selector: 'app-page403',
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective],
  templateUrl: './page403.component.html',
})
export class Page403Component {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly hasAssignedModules = computed(() => this.authService.allowedModules().length > 0);

  switchAccount(): void {
    this.authService.clearSession();
    void this.router.navigate(['/login']);
  }
}
