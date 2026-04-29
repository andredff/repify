import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FollowService, FollowUser } from '../../core/services/follow.service';
import { AuthService } from '../../core/services/auth.service';

export type FollowTab = 'followers' | 'following';

@Component({
  selector: 'app-followers-modal',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-[80] flex flex-col max-w-[430px] mx-auto"
         style="padding-top:env(safe-area-inset-top);animation:shareSlideUp .28s cubic-bezier(.32,.72,0,1) both">

      <!-- Backdrop -->
      <div class="absolute inset-0 bg-bg/95 backdrop-blur-md" (click)="onClose.emit()"></div>

      <!-- Panel -->
      <div class="relative flex flex-col h-full">

        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-bg/80">
          <button (click)="onClose.emit()"
                  class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <p class="text-[15px] font-display font-bold text-white">{{ activeTab() === 'followers' ? 'Seguidores' : 'Seguindo' }}</p>
          <div class="w-9"></div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-border shrink-0">
          <button
            (click)="switchTab('followers')"
            class="flex-1 py-3 text-[13px] font-body font-semibold transition-colors border-b-2"
            [class]="activeTab() === 'followers' ? 'text-primary border-primary' : 'text-text-2 border-transparent hover:text-white'">
            Seguidores {{ followersCount() > 0 ? '(' + followersCount() + ')' : '' }}
          </button>
          <button
            (click)="switchTab('following')"
            class="flex-1 py-3 text-[13px] font-body font-semibold transition-colors border-b-2"
            [class]="activeTab() === 'following' ? 'text-primary border-primary' : 'text-text-2 border-transparent hover:text-white'">
            Seguindo {{ followingCount() > 0 ? '(' + followingCount() + ')' : '' }}
          </button>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto">

          @if (loading()) {
            <div class="flex flex-col gap-3 px-4 pt-5">
              @for (_ of [0,1,2,3]; track $index) {
                <div class="flex items-center gap-3 animate-pulse">
                  <div class="w-11 h-11 rounded-full bg-card-2 shrink-0"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-3 w-2/5 bg-card-2 rounded-lg"></div>
                    <div class="h-2.5 w-1/3 bg-card-2 rounded-lg"></div>
                  </div>
                  <div class="w-20 h-8 bg-card-2 rounded-xl"></div>
                </div>
              }
            </div>
          }

          @if (!loading() && users().length === 0) {
            <div class="flex flex-col items-center justify-center h-64 gap-3">
              <span class="text-5xl">👥</span>
              <p class="text-[14px] font-body font-semibold text-white">
                {{ activeTab() === 'followers' ? 'Nenhum seguidor ainda' : 'Não está seguindo ninguém' }}
              </p>
            </div>
          }

          @if (!loading() && users().length > 0) {
            <div class="divide-y divide-border">
              @for (u of users(); track u.id) {
                <div class="flex items-center gap-3 px-4 py-3.5">

                  <!-- Avatar -->
                  <button (click)="goToProfile(u)" class="w-11 h-11 rounded-full border border-border bg-card overflow-hidden shrink-0 flex items-center justify-center text-lg active:opacity-70">
                    @if (u.avatar) {
                      <img [src]="u.avatar" alt="" class="w-full h-full object-cover" />
                    } @else {
                      <span class="text-sm font-bold text-text-2">{{ u.name.charAt(0).toUpperCase() }}</span>
                    }
                  </button>

                  <!-- Info -->
                  <button (click)="goToProfile(u)" class="flex-1 min-w-0 text-left active:opacity-70">
                    <p class="text-[13px] font-body font-semibold text-white truncate">{{ u.name }}</p>
                    @if (u.username) {
                      <p class="text-[11px] text-text-2 font-body truncate">@{{ u.username }}</p>
                    }
                  </button>

                  <!-- Follow button (not shown for own user) -->
                  @if (u.id !== myId()) {
                    <button
                      (click)="toggleFollow(u)"
                      [disabled]="pendingIds().has(u.id)"
                      class="px-3 py-1.5 rounded-xl text-[12px] font-body font-semibold transition-all active:scale-95 disabled:opacity-50"
                      [class]="u.isFollowing
                        ? 'bg-card-2 border border-border text-text-2 hover:border-danger hover:text-danger'
                        : 'bg-primary text-bg hover:shadow-glow'">
                      {{ u.isFollowing ? 'Seguindo' : 'Seguir' }}
                    </button>
                  }

                </div>
              }
            </div>
          }

          <div class="h-8"></div>
        </div>
      </div>
    </div>
  `,
})
export class FollowersModalComponent implements OnInit {
  userId      = input.required<string>();
  initialTab  = input<FollowTab>('followers');
  followersCount = input<number>(0);
  followingCount = input<number>(0);

  onClose         = output<void>();
  onCountsChanged = output<{ followers: number; following: number }>();

  private followSvc = inject(FollowService);
  private auth      = inject(AuthService);
  private router    = inject(Router);

  activeTab  = signal<FollowTab>('followers');
  users      = signal<FollowUser[]>([]);
  loading    = signal(false);
  pendingIds = signal<Set<string>>(new Set());

  myId = () => this.auth.user()?.id ?? '';

  async ngOnInit(): Promise<void> {
    this.activeTab.set(this.initialTab());
    await this.loadUsers();
  }

  async switchTab(tab: FollowTab): Promise<void> {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    await this.loadUsers();
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const list = this.activeTab() === 'followers'
        ? await this.followSvc.getFollowers(this.userId())
        : await this.followSvc.getFollowing(this.userId());
      this.users.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFollow(user: FollowUser): Promise<void> {
    const pending = new Set(this.pendingIds());
    pending.add(user.id);
    this.pendingIds.set(pending);

    const wasFollowing = user.isFollowing;
    this.users.update(list =>
      list.map(u => u.id === user.id ? { ...u, isFollowing: !wasFollowing } : u)
    );

    try {
      if (wasFollowing) {
        await this.followSvc.unfollow(user.id);
      } else {
        await this.followSvc.follow(user.id);
      }
    } catch {
      this.users.update(list =>
        list.map(u => u.id === user.id ? { ...u, isFollowing: wasFollowing } : u)
      );
    } finally {
      const p = new Set(this.pendingIds());
      p.delete(user.id);
      this.pendingIds.set(p);
    }
  }

  goToProfile(u: FollowUser): void {
    this.onClose.emit();
    const handle = u.username || u.id;
    this.router.navigateByUrl(`/u/${handle}`);
  }
}
