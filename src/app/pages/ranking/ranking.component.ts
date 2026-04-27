import { Component, inject, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { RankingService } from '../../core/services/ranking.service';
import { AuthService } from '../../core/services/auth.service';
import { BottomNavComponent } from '../feed/components/bottom-nav.component';
import { Location } from '@angular/common';
import { FeedHeaderComponent } from '../feed/components/feed-header.component';
import { NotificationsPanelComponent } from '../feed/components/notifications-panel.component';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [DecimalPipe, BottomNavComponent, FeedHeaderComponent, NotificationsPanelComponent],
  template: `
    <div class="min-h-screen bg-bg pb-24 max-w-[430px] mx-auto relative overflow-x-hidden">

      <app-feed-header
        [showBack]="true"
        (onBack)="location.back()"
        (onOpenNotifications)="showNotifications.set(true)" />

      <div class="px-4 pt-4" style="padding-top: calc(76px + env(safe-area-inset-top))">

        <section class="pt-5 pb-1">
          <p class="text-[22px] font-display font-bold text-white">Ranking</p>
          <p class="text-[12px] font-body text-text-2 mt-1">Consistência real: XP, treinos concluídos e KM caminhados.</p>
        </section>

        <div class="bg-card border border-border rounded-2xl p-2 mb-5">
          <div class="flex gap-2">
            <button (click)="rankSvc.setSort('xp')"
                    class="flex-1 py-2.5 rounded-xl text-[12px] font-body font-semibold transition-all"
                    [class]="rankSvc.sortBy() === 'xp' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white hover:bg-card-2'">
              XP total
            </button>
            <button (click)="rankSvc.setSort('workouts')"
                    class="flex-1 py-2.5 rounded-xl text-[12px] font-body font-semibold transition-all"
                    [class]="rankSvc.sortBy() === 'workouts' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white hover:bg-card-2'">
              Treinos
            </button>
            <button (click)="rankSvc.setSort('distance')"
                    class="flex-1 py-2.5 rounded-xl text-[12px] font-body font-semibold transition-all"
                    [class]="rankSvc.sortBy() === 'distance' ? 'bg-primary text-bg shadow-glow-sm' : 'text-text-2 hover:text-white hover:bg-card-2'">
              KM
            </button>
          </div>
        </div>

            @if (rankSvc.myEntry(); as me) {
              <section class="relative overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/12 via-card to-card-2 p-4 mb-5">
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"></div>
                <div class="flex items-start gap-3">
                  <div class="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                    <span class="text-[14px] font-display font-bold text-primary">#{{ me.rank }}</span>
                  </div>

                  <div class="w-12 h-12 rounded-full border border-primary/40 overflow-hidden bg-card shrink-0">
                    @if (auth.avatarUrl()) {
                      <img [src]="auth.avatarUrl()" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-[16px] font-display font-bold text-primary">
                        {{ myInitial() }}
                      </div>
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-[14px] font-body font-semibold text-white truncate">{{ me.name || 'Você' }}</p>
                        <p class="text-[11px] font-body text-text-2 truncate">{{ me.username ? '@' + me.username : 'Seu desempenho no ranking geral' }}</p>
                      </div>
                      <button (click)="shareMyRank()"
                              class="px-3 py-1.5 rounded-lg border border-primary/30 text-[11px] font-body font-semibold text-primary hover:bg-primary/10 transition-colors">
                        Compartilhar
                      </button>
                    </div>

                    <div class="grid grid-cols-2 gap-2 mt-3">
                      <div class="rounded-xl bg-bg/55 border border-border px-3 py-2">
                        <p class="text-[10px] font-body text-text-2">XP total</p>
                        <p class="text-[13px] font-display font-bold text-white">{{ me.totalXp | number }}</p>
                      </div>
                      <div class="rounded-xl bg-bg/55 border border-border px-3 py-2">
                        <p class="text-[10px] font-body text-text-2">Treinos</p>
                        <p class="text-[13px] font-display font-bold text-white">{{ me.workoutsDone | number }}</p>
                      </div>
                      <div class="rounded-xl bg-bg/55 border border-border px-3 py-2">
                        <p class="text-[10px] font-body text-text-2">KM caminhados</p>
                        <p class="text-[13px] font-display font-bold text-white">{{ me.totalKm | number:'1.1-1' }}</p>
                      </div>
                      <div class="rounded-xl bg-bg/55 border border-border px-3 py-2">
                        <p class="text-[10px] font-body text-text-2">Streak</p>
                        <p class="text-[13px] font-display font-bold text-white">{{ me.streakDays }} dias</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            }

            <div class="flex items-center justify-between mb-3 px-1">
              <div>
                <p class="text-[12px] font-body font-semibold text-white">Todos os atletas</p>
                <p class="text-[11px] font-body text-text-2">{{ rankSvc.total() | number }} perfis ranqueados</p>
              </div>
              <div class="px-2.5 py-1 rounded-full border border-border bg-card text-[10px] font-body text-text-2">
                Ordenado por {{ sortLabel() }}
              </div>
            </div>

            @if (rankSvc.loading() && rankSvc.entries().length === 0) {
              <div class="space-y-3">
                @for (i of [1,2,3,4,5,6]; track i) {
                  <div class="h-28 bg-card rounded-2xl animate-pulse"></div>
                }
              </div>
            } @else if (rankSvc.entries().length === 0) {
              <div class="flex flex-col items-center justify-center py-20 gap-3">
                <span class="text-5xl">🏆</span>
                <p class="text-[14px] font-body text-text-2 text-center">Nenhum usuário no ranking ainda.<br>Complete uma atividade para aparecer aqui.</p>
              </div>
            } @else {
              <div class="space-y-3">
                @for (entry of rankSvc.entries(); track entry.userId) {
                  <article class="rounded-2xl border p-3.5 transition-all"
                           [class]="entry.userId === myUserId ? 'bg-primary/8 border-primary/35 shadow-glow-sm' : 'bg-card border-border hover:border-border-2'">
                    <div class="flex items-start gap-3">
                      <div class="w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0"
                           [class]="entry.rank <= 3 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card-2 text-text-2'">
                        <span class="text-[13px] font-display font-bold">#{{ entry.rank }}</span>
                      </div>

                      <div class="w-11 h-11 rounded-full border border-border overflow-hidden bg-card-2 shrink-0">
                        @if (entry.avatar) {
                          <img [src]="entry.avatar" class="w-full h-full object-cover" />
                        } @else {
                          <div class="w-full h-full flex items-center justify-center text-[15px] font-display font-bold text-white">
                            {{ entry.name.charAt(0) }}
                          </div>
                        }
                      </div>

                      <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <p class="text-[14px] font-body font-semibold text-white truncate">
                              {{ entry.name }}
                              @if (entry.userId === myUserId) {
                                <span class="text-primary text-[11px]">(você)</span>
                              }
                            </p>
                            <p class="text-[11px] font-body text-text-2 truncate">{{ entry.username ? '@' + entry.username : 'atleta Repify' }}</p>
                          </div>
                          @if (entry.streakDays > 0) {
                            <div class="rounded-full bg-card-2 border border-border px-2.5 py-1 text-[10px] font-body text-text-2 shrink-0">
                              🔥 {{ entry.streakDays }}d
                            </div>
                          }
                        </div>

                        <div class="grid grid-cols-3 gap-2 mt-3">
                          <div class="rounded-xl border px-2.5 py-2"
                               [class]="metricClass('xp', entry.userId === myUserId)">
                            <p class="text-[10px] font-body text-text-2">XP</p>
                            <p class="text-[13px] font-display font-bold text-white">{{ entry.totalXp | number }}</p>
                          </div>
                          <div class="rounded-xl border px-2.5 py-2"
                               [class]="metricClass('workouts', entry.userId === myUserId)">
                            <p class="text-[10px] font-body text-text-2">Treinos</p>
                            <p class="text-[13px] font-display font-bold text-white">{{ entry.workoutsDone | number }}</p>
                          </div>
                          <div class="rounded-xl border px-2.5 py-2"
                               [class]="metricClass('distance', entry.userId === myUserId)">
                            <p class="text-[10px] font-body text-text-2">KM</p>
                            <p class="text-[13px] font-display font-bold text-white">{{ entry.totalKm | number:'1.1-1' }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                }
              </div>

              @if (rankSvc.hasMore()) {
                <div class="pt-5 flex justify-center">
                  <button (click)="rankSvc.load()"
                          [disabled]="rankSvc.loadingMore()"
                          class="px-5 py-3 rounded-xl border border-border bg-card text-[13px] font-body font-semibold text-white hover:border-primary/30 hover:bg-card-2 transition-colors disabled:opacity-60">
                    {{ rankSvc.loadingMore() ? 'Carregando...' : 'Carregar mais' }}
                  </button>
                </div>
              }
            }
      </div>
    </div>

    <app-bottom-nav active="ranking" (onNewPost)="router.navigateByUrl('/feed')" />

    @if (showNotifications()) {
      <app-notifications-panel (onClose)="showNotifications.set(false)" />
    }
  `,
})
export class RankingComponent {
  rankSvc = inject(RankingService);
  auth    = inject(AuthService);
  router  = inject(Router);
  location = inject(Location);
  showNotifications = signal(false);

  get myUserId(): string { return this.auth.user()?.id ?? ''; }

  myInitial(): string {
    return this.auth.profile().full_name?.charAt(0)?.toUpperCase()
      || this.auth.user()?.email?.charAt(0)?.toUpperCase() || '?';
  }

  sortLabel(): string {
    if (this.rankSvc.sortBy() === 'workouts') return 'treinos';
    if (this.rankSvc.sortBy() === 'distance') return 'KM caminhados';
    return 'XP total';
  }

  metricClass(metric: 'xp' | 'workouts' | 'distance', isCurrentUser: boolean): string {
    if (this.rankSvc.sortBy() === metric) {
      return isCurrentUser
        ? 'border-primary/40 bg-primary/10'
        : 'border-primary/25 bg-primary/5';
    }
    return isCurrentUser
      ? 'border-primary/20 bg-bg/60'
      : 'border-border bg-card-2';
  }

  async shareMyRank(): Promise<void> {
    const me = this.rankSvc.myEntry();
    if (!me) return;

    const metric = this.rankSvc.sortBy() === 'workouts'
      ? `${me.workoutsDone} treinos`
      : this.rankSvc.sortBy() === 'distance'
        ? `${me.totalKm.toFixed(1)} km caminhados`
        : `${me.totalXp} XP`;

    const text = `Estou em #${me.rank} no ranking do Repify com ${metric}. Bora manter a consistência?`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ranking Repify', text });
        return;
      } catch {
        // fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(text);
  }
}
