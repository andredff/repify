import { Component, inject, input, output, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-feed-header',
  standalone: true,
  template: `
    <header class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 glass border-b border-border">
      <div class="flex items-center justify-between px-4 py-3">

        <!-- Logo -->
        <div class="flex items-center gap-2">
          <img src="logo-transparent.png" alt="Repify" class="h-7 w-auto" />
        </div>

        <!-- Right actions -->
        <div class="flex items-center gap-3">
          <!-- Notif bell -->
          <button class="relative w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-primary hover:border-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full shadow-glow-sm"></span>
          </button>

          <!-- Avatar -> meu perfil público -->
          <button
            (click)="goToMyProfile()"
            class="w-9 h-9 rounded-full border border-primary/40 overflow-hidden flex items-center justify-center text-xs font-display font-bold text-primary bg-gradient-to-br from-primary/30 to-secondary/20 shrink-0 hover:border-primary hover:shadow-glow-sm transition-all active:scale-90">
            @if (auth.avatarUrl()) {
              <img [src]="auth.avatarUrl()" alt="avatar" class="w-full h-full object-cover" />
            } @else {
              {{ initials() }}
            }
          </button>
        </div>
      </div>
    </header>
  `,
})
export class FeedHeaderComponent {
  auth    = inject(AuthService);
  private router = inject(Router);

  userEmail = input<string>('');
  onLogout  = output<void>();

  initials(): string {
    const email = this.userEmail();
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  }

  goToMyProfile(): void {
    const handle = this.auth.profile().username || this.auth.user()?.id;
    if (handle) this.router.navigateByUrl(`/u/${handle}`);
  }
}
