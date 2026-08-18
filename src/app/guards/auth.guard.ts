import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../../features/cuadreEnv/services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isInitializing()) {
    if (authService.isAuthenticated()) {
      const companyId = authService.companyId();
      const role = authService.currentRole();
      
      // If Admin has registered but has no company, redirect to company creation
      if (!companyId && role === 'Admin') {
        // Only redirect if they are not already going there
        const currentUrl = router.url;
        if (!currentUrl.includes('/companies/create')) {
          router.navigate(['/companies/create']);
          return false;
        }
      }
      return true;
    }
    router.navigate(['/login']);
    return false;
  }

  return toObservable(authService.isInitializing).pipe(
    filter((isInit) => !isInit),
    take(1),
    map(() => {
      if (authService.isAuthenticated()) {
        const companyId = authService.companyId();
        const role = authService.currentRole();
        if (!companyId && role === 'Admin') {
          router.navigate(['/companies/create']);
          return false;
        }
        return true;
      }
      router.navigate(['/login']);
      return false;
    })
  );
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.hasRole(['Admin', 'Manager'])) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};
