import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe, Location } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BottomNavComponent } from '../feed/components/bottom-nav.component';
import { FeedHeaderComponent } from '../feed/components/feed-header.component';
import { NotificationsPanelComponent } from '../feed/components/notifications-panel.component';
import { MyRank, RankEntry, RankingService } from '../../core/services/ranking.service';

@Component({
  selector: 'app-ranking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, BottomNavComponent, FeedHeaderComponent, NotificationsPanelComponent],
  template: `
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto relative overflow-x-hidden">
      <app-feed-header
        [showBack]="true"
        (onBack)="location.back()"
        (onOpenNotifications)="showNotifications.set(true)" />

      <div class="flex-1 overflow-y-auto px-4 pb-24" style="padding-top: calc(76px + env(safe-area-inset-top))">
        <section class="pt-0 pb-5">
          <p class="text-[22px] font-display font-bold tracking-tight text-white">Ranking</p>
          <p class="text-[12px] font-body text-text-2 mt-1">Onde a consistência vira prova.</p>
        </section>

        <div class="bg-card border border-border rounded-[20px] p-1.5 mb-4">
          <div class="flex gap-1.5">
            <button (click)="rankSvc.setSort('xp')"
                    class="flex-1 py-2.5 rounded-[14px] text-[12px] font-body font-semibold transition-all"
                    [attr.aria-pressed]="rankSvc.sortBy() === 'xp'"
                    [class]="rankSvc.sortBy() === 'xp' ? 'bg-primary text-bg' : 'text-text-2 hover:text-white hover:bg-card-2'">
              XP total
            </button>
            <button (click)="rankSvc.setSort('workouts')"
                    class="flex-1 py-2.5 rounded-[14px] text-[12px] font-body font-semibold transition-all"
                    [attr.aria-pressed]="rankSvc.sortBy() === 'workouts'"
                    [class]="rankSvc.sortBy() === 'workouts' ? 'bg-primary text-bg' : 'text-text-2 hover:text-white hover:bg-card-2'">
              Treinos
            </button>
            <button (click)="rankSvc.setSort('distance')"
                    class="flex-1 py-2.5 rounded-[14px] text-[12px] font-body font-semibold transition-all"
                    [attr.aria-pressed]="rankSvc.sortBy() === 'distance'"
                    [class]="rankSvc.sortBy() === 'distance' ? 'bg-primary text-bg' : 'text-text-2 hover:text-white hover:bg-card-2'">
              KM
            </button>
          </div>
        </div>

        @if (rankSvc.myEntry(); as me) {
          <section class="rounded-[24px] border border-border bg-card p-3.5 mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-[16px] border border-primary/25 bg-primary/10 flex items-center justify-center shrink-0">
                <span class="text-[14px] font-display font-bold text-primary">#{{ me.rank }}</span>
              </div>

              <div class="w-11 h-11 rounded-full border border-border overflow-hidden bg-card-2 shrink-0">
                @if (avatarFor(me, true)) {
                  <img [src]="avatarFor(me, true)" alt="avatar do usuário" class="w-full h-full object-cover" />
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-[15px] font-display font-bold text-primary">
                    {{ initialFor(me.name) }}
                  </div>
                }
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-[14px] font-body font-semibold text-white truncate">{{ displayName(me.name) }}</p>
                    <p class="text-[11px] font-body text-text-2 truncate">{{ me.username ? '@' + me.username : 'Seu ranking no Repify' }}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-[18px] font-display font-bold text-white">{{ primaryMetric(me) }}</p>
                    <p class="text-[10px] font-body uppercase tracking-[0.18em] text-text-2">{{ sortLabel() }}</p>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border">
                  <p class="text-[11px] font-body text-text-2 truncate">{{ metaLine(me.workoutsDone, me.totalKm, me.streakDays) }}</p>
                  <button (click)="shareMyRank()"
                          class="h-9 px-3 rounded-full border border-border bg-card-2 text-[11px] font-body font-semibold text-white hover:border-primary/30 hover:text-primary transition-colors">
                    {{ shareLabel() }}
                  </button>
                </div>

                @if (shareFeedback()) {
                  <p class="text-[11px] font-body text-primary mt-2">{{ shareFeedback() }}</p>
                }
              </div>
            </div>
          </section>
        }

        <div class="flex items-center justify-between mb-3 px-1">
          <div>
            <p class="text-[12px] font-body font-semibold text-white">Todos os atletas</p>
            <p class="text-[11px] font-body text-text-2">{{ rankSvc.total() | number }} perfis ranqueados</p>
          </div>
          <div class="px-2.5 py-1 rounded-full border border-border bg-card text-[10px] font-body uppercase tracking-[0.16em] text-text-2">
            {{ sortLabel() }}
          </div>
        </div>

        @if (rankSvc.loading() && rankSvc.entries().length === 0) {
          <div class="space-y-2">
            @for (i of [1, 2, 3, 4, 5, 6]; track i) {
              <div class="h-[76px] bg-card rounded-[20px] animate-pulse"></div>
            }
          </div>
        } @else if (rankSvc.entries().length === 0) {
          <div class="flex flex-col items-center justify-center py-20 gap-3">
            <span class="text-5xl">🏆</span>
            <p class="text-[14px] font-body text-text-2 text-center">Nenhum usuário no ranking ainda.<br>Complete uma atividade para aparecer aqui.</p>
          </div>
        } @else {
          <div class="space-y-2">
            @for (entry of rankSvc.entries(); track entry.userId) {
              <article class="rounded-[22px] border px-3.5 py-3 transition-all"
                       [class]="entry.userId === myUserId ? 'bg-primary/7 border-primary/30' : 'bg-card border-border'">
                <div class="flex items-center gap-3">
                  <div class="w-9 text-center shrink-0">
                    <p class="text-[15px] font-display font-bold"
                       [class]="entry.rank <= 3 ? 'text-primary' : entry.userId === myUserId ? 'text-white' : 'text-text-2'">
                      #{{ entry.rank }}
                    </p>
                  </div>

                  <div class="w-10 h-10 rounded-full border border-border overflow-hidden bg-card-2 shrink-0">
                    @if (avatarFor(entry)) {
                      <img [src]="avatarFor(entry)" alt="avatar do usuário" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-[14px] font-display font-bold text-white">
                        {{ initialFor(entry.name) }}
                      </div>
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-[13px] font-body font-semibold text-white truncate">
                          {{ displayName(entry.name) }}
                          @if (entry.userId === myUserId) {
                            <span class="text-primary text-[11px]">(você)</span>
                          }
                        </p>
                        <p class="text-[11px] font-body text-text-2 truncate">{{ entry.username ? '@' + entry.username : metaLine(entry.workoutsDone, entry.totalKm, entry.streakDays) }}</p>
                      </div>
                      <div class="text-right shrink-0">
                        <p class="text-[16px] font-display font-bold text-white">{{ primaryMetric(entry) }}</p>
                        <p class="text-[10px] font-body text-text-2">{{ secondaryMetrics(entry) }}</p>
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
                      class="h-11 px-4 rounded-full border border-border bg-card text-[12px] font-body font-semibold text-white hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-60">
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
  auth = inject(AuthService);
  router = inject(Router);
  location = inject(Location);
  showNotifications = signal(false);
  shareFeedback = signal('');

  get myUserId(): string {
    return this.auth.user()?.id ?? '';
  }

  myInitial(): string {
    return this.auth.profile().full_name?.charAt(0)?.toUpperCase()
      || this.auth.user()?.email?.charAt(0)?.toUpperCase()
      || '?';
  }

  initialFor(name: string | null | undefined): string {
    const cleaned = (name ?? '').trim();
    return cleaned ? cleaned.charAt(0).toUpperCase() : this.myInitial();
  }

  displayName(name: string | null | undefined): string {
    const cleaned = (name ?? '').trim();
    return cleaned || 'Usuário';
  }

  avatarFor(entry: Pick<RankEntry, 'avatar'> | Pick<MyRank, 'avatar'>, useOwnFallback = false): string {
    return entry.avatar || (useOwnFallback ? this.auth.avatarUrl() : '');
  }

  sortLabel(): string {
    if (this.rankSvc.sortBy() === 'workouts') return 'treinos';
    if (this.rankSvc.sortBy() === 'distance') return 'KM caminhados';
    return 'XP total';
  }

  shareLabel(): string {
    return this.shareFeedback() ? this.shareFeedback() : 'Compartilhar';
  }

  primaryMetric(entry: Pick<RankEntry, 'totalXp' | 'workoutsDone' | 'totalKm'> | Pick<MyRank, 'totalXp' | 'workoutsDone' | 'totalKm'>): string {
    if (this.rankSvc.sortBy() === 'workouts') return `${entry.workoutsDone}`;
    if (this.rankSvc.sortBy() === 'distance') return `${entry.totalKm.toFixed(1)} km`;
    return `${entry.totalXp}`;
  }

  secondaryMetrics(entry: Pick<RankEntry, 'totalXp' | 'workoutsDone' | 'totalKm' | 'streakDays'>): string {
    if (this.rankSvc.sortBy() === 'workouts') {
      return `${entry.totalXp} XP • ${entry.totalKm.toFixed(1)} km`;
    }
    if (this.rankSvc.sortBy() === 'distance') {
      return `${entry.totalXp} XP • ${entry.workoutsDone} treinos`;
    }
    return `${entry.workoutsDone} treinos • ${entry.totalKm.toFixed(1)} km`;
  }

  metaLine(workoutsDone: number, totalKm: number, streakDays: number): string {
    const parts = [`${workoutsDone} treinos`, `${totalKm.toFixed(1)} km`];
    if (streakDays > 0) parts.push(`🔥 ${streakDays}d`);
    return parts.join(' • ');
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
    const blob = await this.renderShareCard(me);

    if (blob) {
      const file = new File([blob], `repify-ranking-${me.rank}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Repify', text });
          this.flashShareFeedback('Compartilhado');
          return;
        } catch {
          // fall through
        }
      }

      this.downloadShareCard(file);

      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // ignore clipboard failures after download fallback
      }
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ranking Repify', text });
        this.flashShareFeedback('Compartilhado');
        return;
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      this.flashShareFeedback('Copiado');
    } catch {
      this.flashShareFeedback('Sem suporte');
    }
  }

  private flashShareFeedback(message: string): void {
    this.shareFeedback.set(message);
    setTimeout(() => this.shareFeedback.set(''), 2200);
  }

  private downloadShareCard(file: File): void {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
    this.flashShareFeedback('Imagem salva');
  }

  private async renderShareCard(me: MyRank): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0B0F14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#111821';
    this.roundRect(ctx, 60, 60, 960, 1230, 42);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 60, 60, 960, 1230, 42);
    ctx.stroke();

    ctx.fillStyle = '#00FF88';
    ctx.font = '700 34px Arial';
    ctx.fillText('REPIFY RANKING', 110, 145);

    ctx.fillStyle = '#F5F7FA';
    ctx.font = '700 138px Arial';
    ctx.fillText(`#${me.rank}`, 110, 330);

    ctx.fillStyle = '#96A0AA';
    ctx.font = '500 36px Arial';
    ctx.fillText(me.username ? `@${me.username}` : 'consistencia em movimento', 112, 390);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 58px Arial';
    ctx.fillText(me.name || 'Voce', 110, 500);

    ctx.fillStyle = '#96A0AA';
    ctx.font = '500 32px Arial';
    ctx.fillText('Minha consistencia no Repify', 110, 548);

    const metrics = [
      { label: 'XP total', value: `${me.totalXp}` },
      { label: 'Treinos', value: `${me.workoutsDone}` },
      { label: 'KM caminhados', value: `${me.totalKm.toFixed(1)}` },
      { label: 'Streak', value: `${me.streakDays} dias` },
    ];

    let y = 650;
    for (const metric of metrics) {
      ctx.fillStyle = '#0D1117';
      this.roundRect(ctx, 110, y, 860, 120, 28);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 2;
      this.roundRect(ctx, 110, y, 860, 120, 28);
      ctx.stroke();

      ctx.fillStyle = '#96A0AA';
      ctx.font = '500 26px Arial';
      ctx.fillText(metric.label.toUpperCase(), 145, y + 44);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 46px Arial';
      ctx.fillText(metric.value, 145, y + 92);

      y += 145;
    }

    ctx.fillStyle = '#00FF88';
    ctx.font = '700 32px Arial';
    ctx.fillText(this.shareHeadline(me), 110, 1210);

    ctx.fillStyle = '#96A0AA';
    ctx.font = '500 28px Arial';
    ctx.fillText('Treine. caminhe. compartilhe no Repify.', 110, 1260);

    return await new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
  }

  private shareHeadline(me: Pick<MyRank, 'totalXp' | 'workoutsDone' | 'totalKm'>): string {
    if (this.rankSvc.sortBy() === 'workouts') {
      return `${me.workoutsDone} treinos e subindo.`;
    }
    if (this.rankSvc.sortBy() === 'distance') {
      return `${me.totalKm.toFixed(1)} km de consistencia.`;
    }
    return `${me.totalXp} XP de evolucao real.`;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
