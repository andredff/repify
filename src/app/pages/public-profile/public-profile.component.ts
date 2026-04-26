import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PostService } from '../../core/services/post.service';
import { UserService } from '../../core/services/user.service';
import { BottomNavComponent } from '../feed/components/bottom-nav.component';
import { WorkoutPostComponent } from '../feed/components/workout-post.component';
import { WorkoutPost } from '../../core/models/workout-post.model';

interface PublicUser {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  level: string;
  goal: string;
  isOwn: boolean;
}

const GOAL_LABELS: Record<string, string> = {
  hipertrofia:  '💪 Hipertrofia',
  emagrecimento:'🔥 Emagrecer',
  resistencia:  '⚡ Resistência',
  forca:        '🏋️ Força',
  saude:        '❤️ Saúde',
  performance:  '🏃 Performance',
};

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [BottomNavComponent, WorkoutPostComponent],
  template: `
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto">

      <!-- Header -->
      <header class="glass border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <button (click)="location.back()"
                class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="flex-1 min-w-0">
          <p class="text-[15px] font-body font-semibold text-white truncate">
            {{ publicUser()?.username ? '@' + publicUser()!.username : publicUser()?.name || '...' }}
          </p>
          <p class="text-[11px] text-text-2 font-body">{{ posts().length }} publicações</p>
        </div>
        @if (publicUser()?.isOwn) {
          <button (click)="router.navigateByUrl('/profile')"
                  class="text-[12px] font-body text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors">
            Editar
          </button>
        }
      </header>

      @if (loading()) {
        <!-- Skeleton -->
        <div class="flex flex-col items-center pt-10 px-4 gap-4 animate-pulse">
          <div class="w-24 h-24 rounded-full bg-card-2 border-2 border-border"></div>
          <div class="h-4 w-32 bg-card-2 rounded-lg"></div>
          <div class="h-3 w-48 bg-card-2 rounded-lg"></div>
          <div class="flex gap-6 mt-2">
            <div class="h-10 w-14 bg-card-2 rounded-xl"></div>
            <div class="h-10 w-14 bg-card-2 rounded-xl"></div>
            <div class="h-10 w-14 bg-card-2 rounded-xl"></div>
          </div>
        </div>
      } @else if (publicUser()) {

        <div class="flex-1 overflow-y-auto pb-28">

          <!-- ── Profile Header ── -->
          <div class="relative px-4 pt-8 pb-6">

            <!-- Background glow -->
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl pointer-events-none"
                 style="background: radial-gradient(circle, #00FF8808, transparent 70%)"></div>

            <!-- Cover accent bar -->
            <div class="absolute top-0 left-0 right-0 h-20 overflow-hidden pointer-events-none">
              <div class="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent"></div>
              <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            </div>

            <div class="relative flex flex-col items-center text-center">

              <!-- Avatar -->
              <div class="relative mb-4">
                <div class="w-24 h-24 rounded-full border-2 border-primary/50 shadow-glow overflow-hidden flex items-center justify-center text-3xl font-display font-bold bg-gradient-to-br from-primary/20 to-secondary/10">
                  @if (publicUser()!.avatar) {
                    <img [src]="publicUser()!.avatar" alt="avatar" class="w-full h-full object-cover" />
                  } @else {
                    {{ publicUser()!.name.charAt(0).toUpperCase() }}
                  }
                </div>

                <!-- Level badge -->
                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold whitespace-nowrap border"
                     [class]="levelBadgeClass()">
                  {{ publicUser()!.level }}
                </div>
              </div>

              <!-- Name -->
              <h1 class="text-[22px] font-display font-bold text-white leading-tight">
                {{ publicUser()!.name || 'Sem nome' }}
              </h1>

              <!-- Username -->
              @if (publicUser()!.username) {
                <p class="text-[13px] text-text-2 font-body mt-0.5">@{{ publicUser()!.username }}</p>
              }

              <!-- Goal tag -->
              @if (publicUser()!.goal) {
                <div class="mt-2 inline-flex items-center gap-1.5 bg-card-2 border border-border rounded-full px-3 py-1 text-[11px] font-body text-text-2">
                  {{ goalLabel() }}
                </div>
              }

              <!-- Bio -->
              @if (publicUser()!.bio) {
                <p class="mt-3 text-[13px] font-body text-white/80 leading-relaxed max-w-[280px]">
                  {{ publicUser()!.bio }}
                </p>
              }

              <!-- Stats row -->
              <div class="mt-5 flex items-center gap-0 bg-card-2 border border-border rounded-2xl overflow-hidden w-full max-w-[280px]">
                <div class="flex-1 flex flex-col items-center py-3 border-r border-border">
                  <span class="text-[18px] font-display font-bold text-white">{{ posts().length }}</span>
                  <span class="text-[10px] text-text-2 font-body mt-0.5">posts</span>
                </div>
                <div class="flex-1 flex flex-col items-center py-3 border-r border-border">
                  <span class="text-[18px] font-display font-bold text-primary">🔥 7</span>
                  <span class="text-[10px] text-text-2 font-body mt-0.5">streak</span>
                </div>
                <div class="flex-1 flex flex-col items-center py-3">
                  <span class="text-[18px] font-display font-bold text-white">Elite</span>
                  <span class="text-[10px] text-text-2 font-body mt-0.5">nível</span>
                </div>
              </div>

              <!-- Follow / Message (only if not own profile) -->
              @if (!publicUser()!.isOwn) {
                <div class="flex gap-2 mt-4 w-full max-w-[280px]">
                  <button
                    (click)="toggleFollow()"
                    class="flex-1 py-2.5 rounded-xl text-[13px] font-body font-semibold transition-all active:scale-[0.97]"
                    [class]="following()
                      ? 'bg-card-2 border border-border text-text-2 hover:border-danger hover:text-danger'
                      : 'bg-primary text-bg hover:shadow-glow'">
                    {{ following() ? 'Seguindo' : 'Seguir' }}
                  </button>
                  <button class="w-11 h-11 flex items-center justify-center rounded-xl bg-card-2 border border-border text-text-2 hover:text-white hover:border-border-2 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>
                </div>
              }
            </div>
          </div>

          <!-- ── Divider with section label ── -->
          <div class="flex items-center gap-3 px-4 mb-4">
            <div class="flex-1 h-px bg-border"></div>
            <div class="flex items-center gap-1.5 text-[10px] font-body font-medium text-text-2 uppercase tracking-widest">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
              Publicações
            </div>
            <div class="flex-1 h-px bg-border"></div>
          </div>

          <!-- ── Posts feed ── -->
          @if (posts().length === 0) {
            <div class="flex flex-col items-center justify-center py-16 px-4 gap-3">
              <div class="w-14 h-14 rounded-2xl bg-card-2 border border-border flex items-center justify-center text-2xl">🏋️</div>
              <p class="text-[13px] font-body text-text-2 text-center">Nenhum treino publicado ainda.</p>
            </div>
          } @else {
            <div class="px-4 space-y-4">
              @for (post of postsWithUser(); track post.id; let i = $index) {
                <div class="animate-slide-up" [style.animation-delay]="(i * 0.06) + 's'">
                  <app-workout-post [post]="post" (onLike)="toggleLike(post.id)" (onDelete)="deletePost(post)" />
                </div>
              }
            </div>
          }

        </div>
      } @else {
        <!-- User not found -->
        <div class="flex flex-col items-center justify-center flex-1 gap-4 px-4">
          <div class="w-16 h-16 rounded-2xl bg-card-2 border border-border flex items-center justify-center text-3xl">👤</div>
          <p class="text-[15px] font-body font-semibold text-white">Usuário não encontrado</p>
          <p class="text-[12px] text-text-2 font-body text-center">Este perfil não existe ou foi removido.</p>
          <button (click)="router.navigateByUrl('/feed')"
                  class="mt-2 bg-primary text-bg px-6 py-2.5 rounded-xl text-[13px] font-body font-semibold hover:shadow-glow transition-all">
            Voltar ao feed
          </button>
        </div>
      }

      <app-bottom-nav [active]="isOwn() ? 'profile' : 'feed'" />
    </div>
  `,
})
export class PublicProfileComponent implements OnInit {
  private auth        = inject(AuthService);
  private postService = inject(PostService);
  private userService = inject(UserService);
  router              = inject(Router);
  location            = inject(Location);
  private route       = inject(ActivatedRoute);

  loading    = signal(true);
  publicUser = signal<PublicUser | null>(null);
  posts      = signal<WorkoutPost[]>([]);
  following  = signal(false);

  isOwn = computed(() => this.publicUser()?.isOwn ?? false);

  postsWithUser = computed<WorkoutPost[]>(() =>
    this.posts().map(p => ({
      ...p,
      user: {
        ...p.user,
        id:       this.publicUser()?.id     ?? p.user.id,
        name:     this.publicUser()?.name   ?? p.user.name,
        username: this.publicUser()?.username ?? p.user.username,
        avatar:   this.publicUser()?.avatar ?? p.user.avatar,
      },
    }))
  );

  goalLabel = computed(() => GOAL_LABELS[this.publicUser()?.goal ?? ''] ?? '');

  levelBadgeClass(): string {
    const level = this.publicUser()?.level ?? '';
    if (level === 'Elite') return 'bg-primary/15 text-primary border-primary/30';
    if (level === 'Pro')   return 'bg-secondary/15 text-secondary border-secondary/30';
    return 'bg-border text-text-2 border-border-2';
  }

  async ngOnInit(): Promise<void> {
    const handle = this.route.snapshot.paramMap.get('handle') ?? '';
    await this.waitForAuth();
    this.loadProfile(handle);
  }

  /** Espera o AuthService terminar de restaurar a sessão antes de fazer requests. */
  private waitForAuth(): Promise<void> {
    if (this.auth.initialized()) return Promise.resolve();
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (this.auth.initialized()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  private async loadProfile(handle: string): Promise<void> {
    this.loading.set(true);

    const me     = this.auth.user();
    const myMeta = this.auth.profile();
    const isOwn  = !!me && (
                     handle === me.id
                  || handle === myMeta.username
                  || handle === myMeta.full_name
                  );

    if (isOwn && me) {
      this.publicUser.set({
        id:       me.id,
        name:     myMeta.full_name || me.email?.split('@')[0] || 'Você',
        username: myMeta.username,
        bio:      myMeta.bio,
        avatar:   this.auth.avatarUrl(),
        level:    'Elite',
        goal:     myMeta.goal,
        isOwn:    true,
      });

      try {
        const data = await this.postService.listByUser(me.id);
        this.posts.set(data);
      } catch (err) {
        console.warn('[public-profile] failed to load own posts', err);
        this.posts.set([]);
      }
      this.loading.set(false);
      return;
    }

    // Other users: fetch from API by id or username
    try {
      const found = await this.userService.getUser(handle);
      if (!found) {
        this.publicUser.set(null);
        this.posts.set([]);
        this.loading.set(false);
        return;
      }

      this.publicUser.set({
        id:       found.id,
        name:     found.name,
        username: found.username ?? '',
        bio:      found.bio,
        avatar:   found.avatar,
        level:    found.level,
        goal:     found.goal,
        isOwn:    false,
      });

      try {
        const userPosts = await this.postService.listByUser(found.id);
        this.posts.set(userPosts);
      } catch (err) {
        console.warn('[public-profile] failed to load posts', err);
        this.posts.set([]);
      }
    } catch (err) {
      console.error('[public-profile] failed to load user', err);
      this.publicUser.set(null);
      this.posts.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async deletePost(post: WorkoutPost): Promise<void> {
    const previous = this.posts();
    this.posts.update(all => all.filter(p => p.id !== post.id));
    try {
      await this.postService.deletePost(post.id);
    } catch {
      this.posts.set(previous);
    }
  }

  toggleFollow(): void {
    this.following.update(f => !f);
  }

  async toggleLike(postId: string): Promise<void> {
    this.posts.update(posts =>
      posts.map(p =>
        p.id === postId
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
    );
    try {
      await this.postService.toggleLike(postId);
    } catch {
      this.posts.update(posts =>
        posts.map(p =>
          p.id === postId
            ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
            : p,
        ),
      );
    }
  }
}
