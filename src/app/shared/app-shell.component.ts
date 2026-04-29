import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NewPostModalComponent } from '../pages/feed/components/new-post-modal.component';
import { PostService } from '../core/services/post.service';
import { WorkoutPost } from '../core/models/workout-post.model';
import { PreviewModePromptComponent } from './preview-mode-prompt.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NewPostModalComponent, PreviewModePromptComponent],
  template: `
    <div class="flex min-h-screen bg-bg">

      @if (showProfileBootstrapLoading()) {
        <div class="fixed inset-0 z-[90] flex items-center justify-center bg-bg/92 backdrop-blur-sm">
          <div class="flex flex-col items-center gap-4 rounded-[28px] border border-primary/20 bg-card/95 px-7 py-8 shadow-2xl">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12">
              <svg class="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2.5" stroke-linecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
            <div class="text-center">
              <p class="text-[15px] font-display font-bold text-white">Sincronizando seu perfil</p>
              <p class="mt-1 text-[12px] font-body text-text-2">Aguardando os dados mais recentes do backend.</p>
            </div>
          </div>
        </div>
      }

      <!-- ─── Desktop Sidebar ──────────────────────────────────── -->
      <aside
        class="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[220px] xl:w-[260px]
               border-r border-border bg-bg z-50 overflow-y-auto shrink-0">

        <!-- Logo -->
        <div class="px-5 py-5 border-b border-border">
          <img src="logo-transparent.png" alt="Repify" class="h-10 w-auto" />
        </div>

        <!-- Nav links -->
        <nav class="flex-1 p-3 space-y-0.5">

          <a routerLink="/feed" routerLinkActive #feedRA="routerLinkActive"
             class="flex items-center gap-3 px-4 py-3 rounded-xl font-body text-[14px] font-medium transition-all"
             [class]="feedRA.isActive ? 'text-primary bg-primary/10' : 'text-text-2 hover:text-white hover:bg-card-2'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Feed
          </a>

          @if (!isPreview()) {
            <a routerLink="/my-workout" routerLinkActive #myWorkoutRA="routerLinkActive"
               class="flex items-center gap-3 px-4 py-3 rounded-xl font-body text-[14px] font-medium transition-all"
               [class]="myWorkoutRA.isActive ? 'text-primary bg-primary/10' : 'text-text-2 hover:text-white hover:bg-card-2'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
              Treino
            </a>

            <a routerLink="/progress" routerLinkActive #progressRA="routerLinkActive"
               class="flex items-center gap-3 px-4 py-3 rounded-xl font-body text-[14px] font-medium transition-all"
               [class]="progressRA.isActive ? 'text-primary bg-primary/10' : 'text-text-2 hover:text-white hover:bg-card-2'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-3"/>
              </svg>
              Progresso
            </a>

            <a routerLink="/ranking" routerLinkActive #rankingRA="routerLinkActive"
               class="flex items-center gap-3 px-4 py-3 rounded-xl font-body text-[14px] font-medium transition-all"
               [class]="rankingRA.isActive ? 'text-primary bg-primary/10' : 'text-text-2 hover:text-white hover:bg-card-2'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 21H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h3"/>
                <path d="M16 21h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3"/>
                <rect x="8" y="8" width="8" height="13" rx="1"/>
              </svg>
              Ranking
            </a>

            <a routerLink="/profile" routerLinkActive #profileRA="routerLinkActive"
               class="flex items-center gap-3 px-4 py-3 rounded-xl font-body text-[14px] font-medium transition-all"
               [class]="profileRA.isActive ? 'text-primary bg-primary/10' : 'text-text-2 hover:text-white hover:bg-card-2'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Perfil
            </a>

            <div class="pt-3">
              <button (click)="showNewPost.set(true)"
                      class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary
                             text-bg font-body text-[14px] font-semibold hover:bg-primary/90
                             active:scale-95 transition-all shadow-glow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Novo Post
              </button>
            </div>
          } @else {
            <div class="mt-4 rounded-[26px] border border-primary/20 bg-[linear-gradient(180deg,rgba(0,255,136,0.12),rgba(19,28,38,0.88))] p-4">
              <p class="text-[11px] font-body uppercase tracking-[0.24em] text-primary/80">Preview</p>
              <p class="mt-2 text-[18px] font-display font-bold text-white">Você está no modo preview</p>
              <p class="mt-2 text-[12px] font-body leading-relaxed text-text-2">
                Explore o feed em modo leitura. Crie uma conta para liberar treinos, ranking e interações.
              </p>
              <div class="mt-4 space-y-2">
                <a routerLink="/register"
                   class="flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-[13px] font-body font-semibold text-bg shadow-glow transition-all hover:bg-primary/90">
                  Criar conta
                </a>
                <a routerLink="/login"
                   class="flex w-full items-center justify-center rounded-2xl border border-border bg-card-2 px-4 py-3 text-[13px] font-body font-semibold text-white transition-colors hover:border-primary/40 hover:text-primary">
                  Entrar
                </a>
              </div>
            </div>
          }
        </nav>

        <!-- User info at bottom -->
        <div class="border-t border-border p-4">
          @if (!isPreview()) {
            <a routerLink="/profile"
               class="flex items-center gap-3 rounded-xl p-2 hover:bg-card-2 transition-colors group">
              @if (auth.profile().avatar_url) {
                <img [src]="auth.profile().avatar_url" alt="Avatar"
                     class="w-9 h-9 rounded-full object-cover border border-border shrink-0" />
              } @else {
                <div class="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center
                            justify-center text-[13px] font-display font-bold text-primary shrink-0">
                  {{ userInitial() }}
                </div>
              }
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-body font-semibold text-white truncate group-hover:text-primary transition-colors">
                  {{ userName() }}
                </p>
                <p class="text-[11px] font-body text-text-2 truncate">{{ userEmail() }}</p>
              </div>
            </a>
          } @else {
            <div class="rounded-xl border border-border bg-card-2 p-3">
              <p class="text-[11px] font-body uppercase tracking-[0.18em] text-text-2">Sessão</p>
              <p class="mt-1 text-[14px] font-display font-bold text-white">Visitante</p>
              <p class="mt-1 text-[11px] font-body text-text-2">Acesso liberado apenas para o feed público.</p>
            </div>
          }
        </div>
      </aside>

      <!-- ─── Main content area ───────────────────────────────── -->
      <div class="flex-1 lg:ml-[220px] xl:ml-[260px] min-h-screen">
        <router-outlet />
      </div>
    </div>

    <!-- New post modal (desktop sidebar CTA) -->
    @if (showNewPost()) {
      <app-new-post-modal
        (onClose)="showNewPost.set(false)"
        (onPublish)="onPostPublished($event)" />
    }

    <app-preview-mode-prompt />
  `,
})
export class AppShellComponent {
  auth    = inject(AuthService);
  private postService = inject(PostService);

  showNewPost = signal(false);
  isPreview = computed(() => this.auth.authState() === 'preview');

  userInitial = computed(() => {
    const name = this.auth.profile()?.full_name;
    if (name) return name[0].toUpperCase();
    return this.auth.user()?.email?.[0]?.toUpperCase() ?? '?';
  });

  userName = computed(() =>
    this.auth.profile()?.full_name || this.auth.user()?.email?.split('@')[0] || '',
  );

  userEmail = computed(() => this.auth.user()?.email ?? '');
  showProfileBootstrapLoading = computed(() =>
    this.auth.isAuthenticated() && this.auth.profileSyncing() && !this.auth.profileReady(),
  );

  onPostPublished(post: WorkoutPost): void {
    this.postService.setPendingPost(post);
    this.showNewPost.set(false);
  }
}
