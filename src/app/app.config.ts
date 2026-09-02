import { ApplicationConfig, ErrorHandler, Injectable } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withHashLocation,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { IconSetService } from '@coreui/icons-angular';
import { routes } from './app.routes';
import { authInterceptor, appHttpInterceptor } from './interceptor';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    if (
      error?.name === 'InvalidStateError' ||
      error?.message?.includes('Transition was aborted')
    ) {
      return;
    }
    const message =
      error?.message || (typeof error === 'string' ? error : null);
    if (message) {
      console.error(`[AppError] ${message}`);
    } else if (error && typeof error === 'object') {
      try {
        console.error('[AppError]', JSON.stringify(error));
      } catch {
        console.error('[AppError]', String(error));
      }
    } else {
      console.error('[AppError]', error);
    }
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withRouterConfig({
        onSameUrlNavigation: 'reload',
      }),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
      withEnabledBlockingInitialNavigation(),
      withHashLocation(),
    ),
    IconSetService,
    provideHttpClient(withInterceptors([authInterceptor, appHttpInterceptor])),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
