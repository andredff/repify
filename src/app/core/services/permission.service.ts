import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly _promptReason = signal('');

  readonly isPreview = computed(() => this.auth.authState() === 'preview');
  readonly promptReason = this._promptReason.asReadonly();
  readonly promptOpen = computed(() => this._promptReason().length > 0);

  requireAuthenticated(reason = 'interagir com a comunidade'): boolean {
    if (!this.isPreview()) {
      return true;
    }

    this._promptReason.set(reason);
    return false;
  }

  closePrompt(): void {
    this._promptReason.set('');
  }

  async goToLogin(): Promise<void> {
    this.closePrompt();
    await this.router.navigateByUrl('/login');
  }

  async goToRegister(): Promise<void> {
    this.closePrompt();
    await this.router.navigateByUrl('/register');
  }
}
