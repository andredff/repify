import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-feed-header',
  standalone: true,
  template: `
    <header class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 glass border-b border-border safe-top">
      <div class="flex items-center gap-3 px-4 py-3">

        <div class="flex items-center gap-3 shrink-0">
          @if (showBack()) {
            <button (click)="onBack.emit()"
                    class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white hover:border-border-2 transition-colors"
                    aria-label="Voltar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          }

          <img src="logo-transparent.png" alt="Repify" class="h-9 w-auto" />
        </div>

        @if (title() || subtitle()) {
          <div class="flex-1 min-w-0">
            @if (title()) {
              <p class="text-[15px] font-body font-semibold text-white truncate">{{ title() }}</p>
            }
            @if (subtitle()) {
              <p class="text-[11px] font-body text-text-2 truncate">{{ subtitle() }}</p>
            }
          </div>
        } @else {
          <div class="flex-1"></div>
        }

        <!-- Right actions -->
        <div class="flex items-center gap-3 shrink-0 ml-auto">
          <!-- Notif bell -->
          <button (click)="onOpenNotifications.emit()"
                  class="relative w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-primary hover:border-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            @if (notifSvc.hasUnread()) {
              <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full shadow-glow-sm animate-pulse"></span>
            }
          </button>

          <div class="relative">
            <button
              type="button"
              (click)="toggleMenu()"
              class="relative z-50 w-9 h-9 rounded-full border border-primary/40 overflow-hidden flex items-center justify-center text-xs font-display font-bold text-primary bg-gradient-to-br from-primary/30 to-secondary/20 shrink-0 hover:border-primary hover:shadow-glow-sm transition-all active:scale-90"
              aria-label="Abrir menu do perfil"
              aria-haspopup="menu"
              [attr.aria-expanded]="menuOpen()">
              @if (auth.avatarUrl()) {
                <img [src]="auth.avatarUrl()" alt="avatar" class="w-full h-full object-cover" />
              } @else {
                {{ initials() }}
              }
            </button>

            @if (menuOpen()) {
              <button
                type="button"
                class="fixed inset-0 z-40 cursor-default"
                aria-label="Fechar menu do perfil"
                (click)="closeMenu()"></button>

              <div class="absolute right-0 top-[calc(100%+12px)] z-50 w-[220px] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div class="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
                  <p class="text-[12px] font-body text-text-2">Conectado como</p>
                  <p class="text-[13px] font-display font-bold text-white truncate">{{ displayName() }}</p>
                </div>

                <div class="p-2">
                  <button type="button"
                          (click)="navigate('/progress')"
                          class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-white hover:bg-card-2 transition-colors">
                    <span class="text-[18px]">📈</span>
                    <div>
                      <p class="text-[13px] font-body font-semibold">Meu progresso</p>
                      <p class="text-[11px] font-body text-text-2">Dashboard com evolução e histórico</p>
                    </div>
                  </button>

                  <button type="button"
                          (click)="navigate('/profile')"
                          class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-white hover:bg-card-2 transition-colors">
                    <span class="text-[18px]">👤</span>
                    <div>
                      <p class="text-[13px] font-body font-semibold">Meu perfil</p>
                      <p class="text-[11px] font-body text-text-2">Editar foto, dados e conta</p>
                    </div>
                  </button>

                  <button type="button"
                          (click)="goToPublicProfile()"
                          class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-white hover:bg-card-2 transition-colors">
                    <span class="text-[18px]">🌐</span>
                    <div>
                      <p class="text-[13px] font-body font-semibold">Perfil publico</p>
                      <p class="text-[11px] font-body text-text-2">Ver como outros usuarios enxergam</p>
                    </div>
                  </button>

                  <button type="button"
                          (click)="logout()"
                          class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-danger hover:bg-danger/10 transition-colors">
                    <span class="text-[18px]">↩</span>
                    <div>
                      <p class="text-[13px] font-body font-semibold">Sair</p>
                      <p class="text-[11px] font-body text-text-2">Encerrar a sessão atual</p>
                    </div>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </header>
  `,
})
export class FeedHeaderComponent {
  auth     = inject(AuthService);
  notifSvc = inject(NotificationService);
  private router = inject(Router);

  userEmail          = input<string>('');
  title              = input<string>('');
  subtitle           = input<string>('');
  showBack           = input(false);
  onLogout           = output<void>();
  onBack             = output<void>();
  onOpenNotifications = output<void>();
  menuOpen = signal(false);
  displayName = computed(() => this.auth.profile().full_name || this.auth.user()?.email || 'Usuario');

  initials(): string {
    return this.displayName().charAt(0).toUpperCase() || 'U';
  }

  toggleMenu(): void {
    this.menuOpen.update(value => !value);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  navigate(path: string): void {
    this.closeMenu();
    this.router.navigateByUrl(path);
  }

  goToPublicProfile(): void {
    const handle = this.auth.profile().username || this.auth.user()?.id;
    if (!handle) return;
    this.closeMenu();
    this.router.navigateByUrl(`/u/${handle}`);
  }

  async logout(): Promise<void> {
    this.closeMenu();
    this.onLogout.emit();
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }

}
