import { Component, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { RankingService } from '../../core/services/ranking.service';
import { AuthService } from '../../core/services/auth.service';
import { LEVELS } from '../../core/services/workout.service';
import { BottomNavComponent } from '../feed/components/bottom-nav.component';
import { Location } from '@angular/common';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [DecimalPipe, BottomNavComponent],
  template: `
    <div class="min-h-screen bg-bg pb-24">

      <!-- Header -->
      <div class="sticky top-0 z-30 glass border-b border-border px-4 pt-safe-top pb-3">
        <div class="flex items-center justify-between max-w-[430px] mx-auto">
          <button (click)="location.back()" class="w-8 h-8 flex items-center justify-center text-text-2 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 class="text-[15px] font-display font-bold text-white">Ranking</h1>
          <div class="w-8"></div>
        </div>
      </div>

      <div class="max-w-[430px] mx-auto px-4 pt-4">

        <!-- Mode tabs -->
        <div class="flex gap-1 p-1 bg-card rounded-xl mb-6">
          <button (click)="rankSvc.setMode('global')"
                  class="flex-1 py-2 rounded-lg text-[13px] font-body font-semibold transition-all"
                  [class]="rankSvc.mode() === 'global' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white'">
            🌍 Global
          </button>
          <button (click)="rankSvc.setMode('weekly')"
                  class="flex-1 py-2 rounded-lg text-[13px] font-body font-semibold transition-all"
                  [class]="rankSvc.mode() === 'weekly' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white'">
            📅 Semanal
          </button>
        </div>

        <!-- Loading skeleton -->
        @if (rankSvc.loading()) {
          <div class="space-y-3">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="h-14 bg-card rounded-xl animate-pulse"></div>
            }
          </div>
        } @else if (rankSvc.entries().length === 0) {
          <div class="flex flex-col items-center justify-center py-20 gap-3">
            <span class="text-5xl">🏆</span>
            <p class="text-[14px] font-body text-text-2 text-center">Nenhum usuário no ranking ainda.<br>Complete um treino para aparecer aqui!</p>
          </div>
        } @else {

          <!-- Podium — top 3 -->
          @if (podiumEntries().length > 0) {
            <div class="flex items-end justify-center gap-3 mb-8">

              @if (podiumSecond(); as entry) {
              <!-- 2nd place -->
              <div class="flex flex-col items-center gap-2">
                <div class="relative">
                  <div class="w-14 h-14 rounded-full border-2 border-border overflow-hidden bg-card">
                    @if (entry.avatar) {
                      <img [src]="entry.avatar" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-[18px] font-display font-bold text-white">
                        {{ entry.name.charAt(0) }}
                      </div>
                    }
                  </div>
                  <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#8896A8] flex items-center justify-center text-[10px] font-display font-bold text-white shadow-md">2</div>
                </div>
                <p class="text-[11px] font-body font-semibold text-white max-w-[60px] text-center truncate">{{ entry.name }}</p>
                <div class="h-16 w-20 bg-card-2 rounded-t-xl flex flex-col items-center justify-center border border-border border-b-0">
                  <span class="text-[18px]">🥈</span>
                  <span class="text-[11px] font-body font-semibold text-white">{{ entry.xp | number }}</span>
                  <span class="text-[9px] text-text-2">XP</span>
                </div>
              </div>
              }

              @if (podiumFirst(); as entry) {
              <!-- 1st place -->
              <div class="flex flex-col items-center gap-2">
                <div class="text-2xl animate-bounce">👑</div>
                <div class="relative">
                  <div class="w-18 h-18 w-[72px] h-[72px] rounded-full border-2 border-primary overflow-hidden bg-card shadow-glow">
                    @if (entry.avatar) {
                      <img [src]="entry.avatar" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-[22px] font-display font-bold text-primary">
                        {{ entry.name.charAt(0) }}
                      </div>
                    }
                  </div>
                  <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-display font-bold text-bg shadow-glow-sm">1</div>
                </div>
                <p class="text-[12px] font-body font-bold text-white max-w-[70px] text-center truncate">{{ entry.name }}</p>
                <div class="h-24 w-20 bg-card-2 rounded-t-xl flex flex-col items-center justify-center border border-primary/30 border-b-0">
                  <span class="text-[22px]">🥇</span>
                  <span class="text-[12px] font-body font-bold text-primary">{{ entry.xp | number }}</span>
                  <span class="text-[9px] text-text-2">XP</span>
                </div>
              </div>
              }

              @if (podiumThird(); as entry) {
              <!-- 3rd place -->
              <div class="flex flex-col items-center gap-2">
                <div class="relative">
                  <div class="w-14 h-14 rounded-full border-2 border-border overflow-hidden bg-card">
                    @if (entry.avatar) {
                      <img [src]="entry.avatar" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-[18px] font-display font-bold text-white">
                        {{ entry.name.charAt(0) }}
                      </div>
                    }
                  </div>
                  <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#B45309] flex items-center justify-center text-[10px] font-display font-bold text-white shadow-md">3</div>
                </div>
                <p class="text-[11px] font-body font-semibold text-white max-w-[60px] text-center truncate">{{ entry.name }}</p>
                <div class="h-12 w-20 bg-card-2 rounded-t-xl flex flex-col items-center justify-center border border-border border-b-0">
                  <span class="text-[18px]">🥉</span>
                  <span class="text-[11px] font-body font-semibold text-white">{{ entry.xp | number }}</span>
                  <span class="text-[9px] text-text-2">XP</span>
                </div>
              </div>
              }

            </div>
          }

          <!-- Rest of top 10 -->
          @if (rankSvc.rest().length > 0) {
            <div class="space-y-2 mb-6">
              @for (entry of rankSvc.rest(); track entry.userId) {
                <div class="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
                     [class]="entry.userId === myUserId ? 'border-primary/40 bg-primary/5' : ''">
                  <span class="w-6 text-[13px] font-display font-bold text-text-2 text-center">{{ entry.rank }}</span>
                  <div class="w-9 h-9 rounded-full border border-border overflow-hidden bg-card-2 shrink-0">
                    @if (entry.avatar) {
                      <img [src]="entry.avatar" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-[14px] font-display font-bold text-white">
                        {{ entry.name.charAt(0) }}
                      </div>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-body font-semibold text-white truncate">
                      {{ entry.name }}
                      @if (entry.userId === myUserId) {
                        <span class="text-primary text-[11px]"> (você)</span>
                      }
                    </p>
                    @if (entry.streakDays > 0) {
                      <p class="text-[11px] text-text-2">🔥 {{ entry.streakDays }}d streak</p>
                    }
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-[13px] font-body font-bold" [class]="entry.userId === myUserId ? 'text-primary' : 'text-white'">
                      {{ entry.xp | number }} XP
                    </p>
                    <p class="text-[10px] text-text-2">{{ levelFor(entry.totalXp) }}</p>
                  </div>
                </div>
              }
            </div>
          }

          <!-- My position (pinned if not in top 10) -->
          @if (rankSvc.myRank(); as me) {
            @if (!isInTop10()) {
              <div class="border-t border-border pt-4">
                <p class="text-[11px] font-body text-text-2 mb-2">Sua posição</p>
                <div class="flex items-center gap-3 bg-primary/10 border border-primary/40 rounded-xl px-3 py-2.5">
                  <span class="w-6 text-[13px] font-display font-bold text-primary text-center">#{{ me.rank }}</span>
                  <div class="w-9 h-9 rounded-full border border-primary/40 overflow-hidden bg-card-2 shrink-0">
                    @if (auth.avatarUrl()) {
                      <img [src]="auth.avatarUrl()" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-[14px] font-display font-bold text-primary">
                        {{ myInitial() }}
                      </div>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-body font-semibold text-white truncate">{{ auth.profile().full_name || 'Você' }}</p>
                    @if (me.streakDays > 0) {
                      <p class="text-[11px] text-text-2">🔥 {{ me.streakDays }}d streak</p>
                    }
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-[13px] font-body font-bold text-primary">
                      {{ (rankSvc.mode() === 'weekly' ? me.weeklyXp : me.totalXp) | number }} XP
                    </p>
                    <p class="text-[10px] text-text-2">{{ levelFor(me.totalXp) }}</p>
                  </div>
                </div>
              </div>
            }
          }

        }
      </div>
    </div>

    <app-bottom-nav active="ranking" (onNewPost)="router.navigateByUrl('/feed')" />
  `,
})
export class RankingComponent {
  rankSvc = inject(RankingService);
  auth    = inject(AuthService);
  router  = inject(Router);
  location = inject(Location);

  podiumEntries = computed(() => this.rankSvc.top3());
  podiumFirst = computed(() => this.podiumEntries()[0] ?? null);
  podiumSecond = computed(() => this.podiumEntries()[1] ?? null);
  podiumThird = computed(() => this.podiumEntries()[2] ?? null);

  get myUserId(): string { return this.auth.user()?.id ?? ''; }

  myInitial(): string {
    return this.auth.profile().full_name?.charAt(0)?.toUpperCase()
      || this.auth.user()?.email?.charAt(0)?.toUpperCase() || '?';
  }

  isInTop10(): boolean {
    const me = this.rankSvc.myRank();
    if (!me) return false;
    return this.rankSvc.entries().some(e => e.userId === this.myUserId);
  }

  levelFor(xp: number): string {
    let level = LEVELS[0];
    for (const l of LEVELS) { if (xp >= l.minXp) level = l; else break; }
    return `${level.emoji} ${level.name}`;
  }
}
