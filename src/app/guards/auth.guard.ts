import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../../features/cuadreEnv/services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const redirectLogin = () => {
    const returnUrl = state?.url && !state.url.includes('/login') ? state.url : '/dashboard';
    router.navigate(['/login'], { queryParams: { returnUrl } });
    return false;
  };

  if (!authService.isInitializing()) {
    if (authService.isAuthenticated()) {
      const companyId = authService.companyId();
      const role = authService.currentRole();
      
      // If Admin has registered but has no company, redirect to company creation
      if (!companyId && role === 'Admin') {
        const currentUrl = router.url;
        if (!currentUrl.includes('/companies/create')) {
          router.navigate(['/companies/create']);
          return false;
        }
      }
      return true;
    }
    return redirectLogin();
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
      return redirectLogin();
    })
  );
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (
    authService.isAuthenticated() &&
    (authService.isSuperUser() || authService.hasRole(['Admin', 'SuperUser', 'SuperAdmin', 'SysAdmin', 'Manager']))
  ) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};
