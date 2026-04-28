import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const previewModeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        if (auth.initialized()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  if (auth.authState() === 'auth' || auth.authState() === 'preview') {
    return true;
  }

  return router.createUrlTree(['/']);
};
