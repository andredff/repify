import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, input, output, signal } from '@angular/core';
import { RankingProgressBarComponent } from './ranking-progress-bar.component';
import { RadarMetricComponent } from './radar-metric.component';

@Component({
  selector: 'app-radar-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RankingProgressBarComponent, RadarMetricComponent],
  template: `
    <section class="relative overflow-hidden rounded-[28px] border border-white/8 bg-card-2 p-4 shadow-[0_14px_44px_rgba(0,0,0,0.24)] sm:p-5">
      <div class="pointer-events-none absolute right-[-40px] top-[-24px] h-28 w-28 rounded-full bg-primary/8 blur-3xl"></div>

      <div class="relative z-[1] space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/16 bg-primary/10 text-[15px] text-primary">◉</span>
              <p class="text-[10px] font-body uppercase tracking-[0.22em] text-text-2">Radar Diário</p>
            </div>
            <p class="text-[12px] font-body leading-5 text-text-2">{{ summaryLine() }}</p>
          </div>

          <button type="button"
                  (click)="openRanking.emit()"
                  class="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-body font-semibold text-text-2 transition-colors hover:border-primary/25 hover:text-white">
            Ranking
          </button>
        </div>

        <div class="rounded-[24px] border border-white/6 bg-black/15 px-4 py-4 sm:px-5">
          <p class="text-[11px] font-body uppercase tracking-[0.18em] text-text-2">Posição atual</p>
          <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div class="min-w-0">
              <div class="flex items-end gap-3">
                <p class="text-[40px] font-display font-bold leading-none tracking-[-0.04em] text-white sm:text-[48px]">#{{ displayedRank() }}</p>
                <span class="mb-1 rounded-full border px-2.5 py-1 text-[10px] font-body font-semibold"
                      [class]="variationClass()">
                  {{ variationBadge() }}
                </span>
              </div>
              <p class="mt-3 text-[16px] font-display font-bold tracking-tight text-white sm:text-[18px]">{{ primaryInsight() }}</p>
            </div>

            <div class="rounded-2xl border border-primary/14 bg-primary/[0.05] px-3.5 py-3 sm:max-w-[180px]">
              <p class="text-[10px] font-body uppercase tracking-[0.18em] text-text-2">Próximo passo</p>
              <p class="mt-2 text-[13px] font-body font-semibold leading-5 text-primary">{{ urgencyLine() }}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
          <app-radar-metric
            label="Variação"
            [value]="variationValue()"
            [caption]="variationCaption()"
            [badge]="variationBadge()"
            [highlight]="recentDelta() > 0"
            [negative]="recentDelta() < 0" />

          <app-radar-metric
            label="Streak"
            [value]="'🔥 ' + streakDays()"
            caption="dias em sequência"
            [badge]="streakDays() >= 5 ? 'quente' : ''"
            [highlight]="streakDays() >= 5" />

          <app-radar-metric
            label="XP do dia"
            [value]="'+' + dailyXp()"
            caption="ganho acumulado hoje"
            [badge]="dailyXp() > 0 ? 'ativo' : 'parado'"
            [highlight]="dailyXp() > 0" />
        </div>

        <div class="rounded-[22px] border border-white/6 bg-black/10 px-4 py-3.5">
          <app-ranking-progress-bar
            [progress]="progressPct()"
            [progressLabel]="xpNeedLabel()"
            [detailLabel]="progressDetail()" />
        </div>

        @if (shouldPulse()) {
          <div class="pointer-events-none absolute inset-0 rounded-[28px] border border-primary/18 animate-[radarPulse_1.2s_ease-out]"></div>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    @media (min-width: 400px) {
      .xs\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @keyframes radarPulse {
      0% { opacity: 0.9; box-shadow: 0 0 0 rgba(0,255,136,0.16); }
      100% { opacity: 0; box-shadow: 0 0 36px rgba(0,255,136,0); }
    }
  `],
})
export class RadarCardComponent implements OnDestroy {
  currentRank = input(0);
  previousRank = input<number | null>(null);
  recentDelta = input(0);
  streakDays = input(0);
  dailyXp = input(0);
  positionsToClimb = input(0);
  xpToClimb = input(0);
  progressPct = input(0);

  readonly openRanking = output<void>();

  readonly displayedRank = signal(0);
  readonly shouldPulse = signal(false);
  readonly summaryLine = computed(() => {
    if (this.recentDelta() > 0) return `Hoje você subiu ${this.recentDelta()} ${this.recentDelta() === 1 ? 'posição' : 'posições'}.`;
    if (this.recentDelta() < 0) return `Hoje você caiu ${Math.abs(this.recentDelta())} ${Math.abs(this.recentDelta()) === 1 ? 'posição' : 'posições'}.`;
    return 'Seu ritmo está estável hoje.';
  });
  readonly primaryInsight = computed(() => {
    if (this.recentDelta() > 0) return `Você ganhou ${this.recentDelta()} ${this.recentDelta() === 1 ? 'posição' : 'posições'} hoje`;
    if (this.recentDelta() < 0) return `Você perdeu ${Math.abs(this.recentDelta())} ${Math.abs(this.recentDelta()) === 1 ? 'posição' : 'posições'} hoje`;
    return `Você está em #${Math.max(this.currentRank(), 1)} hoje`;
  });
  readonly urgencyLine = computed(() => this.positionsToClimb() > 0
    ? `+${this.xpToClimb()} XP para subir ${this.positionsToClimb()} ${this.positionsToClimb() === 1 ? 'posição' : 'posições'}`
    : 'Mantenha a liderança');
  readonly variationValue = computed(() => {
    if (this.recentDelta() > 0) return `+${this.recentDelta()}`;
    if (this.recentDelta() < 0) return `${this.recentDelta()}`;
    return '0';
  });
  readonly variationBadge = computed(() => {
    if (this.recentDelta() > 0) return 'subiu';
    if (this.recentDelta() < 0) return 'desceu';
    return 'estável';
  });
  readonly variationCaption = computed(() => this.recentDelta() > 0
    ? 'movimento positivo no ranking'
    : this.recentDelta() < 0
      ? 'alguém passou você'
      : 'sem mudança recente');
  readonly progressDetail = computed(() => this.currentRank() <= 1
    ? 'Todo mundo está perseguindo você'
    : `${this.progressPct()}% para ultrapassar o próximo`);
  readonly xpNeedLabel = computed(() => this.positionsToClimb() > 0
    ? `+${this.xpToClimb()} XP para subir ${this.positionsToClimb()} ${this.positionsToClimb() === 1 ? 'posição' : 'posições'}`
    : 'Você já está no topo do ranking');
  readonly variationClass = computed(() => {
    if (this.recentDelta() > 0) return 'border-primary/18 bg-primary/10 text-primary';
    if (this.recentDelta() < 0) return 'border-danger/18 bg-danger/10 text-danger';
    return 'border-white/8 bg-white/[0.04] text-text-2';
  });

  private rankTimer: ReturnType<typeof setInterval> | null = null;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.currentRank();
      this.previousRank();
      this.recentDelta();
      this.dailyXp();
      this.startRankAnimation();
      this.triggerPulse();
    });
  }

  ngOnDestroy(): void {
    if (this.rankTimer) clearInterval(this.rankTimer);
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
  }

  private startRankAnimation(): void {
    if (this.rankTimer) clearInterval(this.rankTimer);

    const target = Math.max(this.currentRank(), 1);
    const start = Math.max(this.previousRank() ?? target, 1);
    this.displayedRank.set(start);
    if (start === target) return;

    const direction = target < start ? -1 : 1;
    const totalSteps = Math.max(Math.abs(start - target), 1);
    const interval = Math.max(26, Math.floor(420 / totalSteps));

    this.rankTimer = setInterval(() => {
      const next = this.displayedRank() + direction;
      this.displayedRank.set(next);
      if (next === target && this.rankTimer) {
        clearInterval(this.rankTimer);
        this.rankTimer = null;
      }
    }, interval);
  }

  private triggerPulse(): void {
    this.shouldPulse.set(this.recentDelta() > 0 || this.dailyXp() > 0);
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    if (!this.shouldPulse()) return;
    this.pulseTimer = setTimeout(() => this.shouldPulse.set(false), 1200);
  }
}
