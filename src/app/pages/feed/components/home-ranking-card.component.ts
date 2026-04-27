import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, input, output, signal } from '@angular/core';
import { RankingProgressBarComponent } from './ranking-progress-bar.component';

@Component({
  selector: 'app-home-ranking-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RankingProgressBarComponent],
  template: `
    <section class="relative overflow-hidden rounded-[28px] border border-primary/20 bg-[linear-gradient(180deg,rgba(10,17,23,0.98),rgba(8,12,16,1))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:p-5">
      <div class="hero-grid relative z-[1]">
        <div class="space-y-4 sm:space-y-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-2">
              <p class="text-[10px] font-body uppercase tracking-[0.26em] text-primary/70">Radar diário</p>
              <div class="flex items-end gap-2.5 sm:gap-3">
                <div class="rank-orb flex h-[68px] w-[68px] items-center justify-center rounded-[22px] border border-primary/14 bg-primary/[0.06] shadow-[0_0_24px_rgba(0,255,136,0.08)] sm:h-[76px] sm:w-[76px] sm:rounded-[24px]">
                  <span class="text-[24px] font-display font-bold tracking-tight text-primary sm:text-[28px]">#{{ displayedRank() }}</span>
                </div>
                <div class="min-w-0 pb-0.5 mb-4">
                  <p class="text-[11px] font-body text-text-2">posição atual</p>
                  <p class="mt-1 text-[16px] font-display font-bold leading-none tracking-tight text-white sm:text-[26px]">{{ headline() }}</p>
                </div>
              </div>
            </div>

            <button type="button"
                    (click)="openRanking.emit()"
                    class="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-body font-semibold text-text-2 transition-colors hover:border-primary/25 hover:text-white">
              Ver ranking
            </button>
          </div>

          <div class="message-stack min-h-[18px] sm:min-h-[48px]">
            <p class="message-line text-[14px] font-display font-bold tracking-tight text-white sm:text-[16px]" [class.is-hidden]="messageStep() !== 0">
              Você está em #{{ displayedRank() }} hoje
            </p>
            <p class="message-line text-[13px] font-body font-semibold text-primary sm:text-[14px]" [class.is-hidden]="messageStep() !== 1">
              {{ urgencyLine() }}
            </p>
          </div>
        </div>

        <div class="space-y-3.5 sm:space-y-4">
          <app-ranking-progress-bar
            [progress]="progressPct()"
            [progressLabel]="xpNeedLabel()"
            [detailLabel]="progressDetail()" />
        </div>
      </div>

      @if (xpDelta() > 0 || recentDelta() !== 0) {
        <div class="feedback-burst" aria-live="polite">
          @if (xpDelta() > 0) {
            <span class="feedback-pill">+{{ xpDelta() }} XP</span>
          }
          @if (recentDelta() > 0) {
            <span class="feedback-pill rank-up">#{{ previousDisplayRank() }} → #{{ currentRank() }}</span>
          }
        </div>
      }

    </section>
  `,
  styles: [`
    :host { display:block; }
    .rank-hero { animation: heroEnter 680ms cubic-bezier(.22,1,.36,1) both; }
    .hero-grid { display:grid; gap:1rem; }
    .rank-orb { animation: orbPulse 2.6s ease-in-out infinite; }
    .metric-panel {
      display:flex;
      flex-direction:column;
      gap:0.22rem;
      border:1px solid rgba(255,255,255,0.06);
      background:rgba(255,255,255,0.025);
      border-radius:0.95rem;
      padding:0.72rem 0.8rem;
    }
    .metric-label {
      font-size:0.58rem;
      letter-spacing:0.18em;
      text-transform:uppercase;
      color:var(--color-text-2, #96A0AA);
      font-family:var(--font-body, inherit);
    }
    .metric-value {
      font-size:0.92rem;
      font-weight:700;
      line-height:1.05;
      color:#F5F7FA;
      font-family:var(--font-display, inherit);
    }
    .message-stack { position:relative; }
    .message-line {
      position:absolute;
      inset:0 auto auto 0;
      transition:opacity 320ms ease, transform 420ms ease;
    }
    .message-line.is-hidden {
      opacity:0;
      transform:translateY(10px);
      pointer-events:none;
    }
    .feedback-burst {
      position:absolute;
      left:1rem;
      top:0.85rem;
      display:flex;
      flex-wrap:wrap;
      gap:0.5rem;
      pointer-events:none;
    }
    .feedback-pill {
      border:1px solid rgba(0,255,136,0.3);
      background:rgba(0,255,136,0.14);
      color:#00FF88;
      padding:0.4rem 0.7rem;
      border-radius:999px;
      font-size:0.66rem;
      font-weight:700;
      font-family:var(--font-body, inherit);
      animation: feedbackRise 1.25s cubic-bezier(.2,.9,.25,1) both;
      box-shadow:0 0 24px rgba(0,255,136,0.14);
    }
    .rank-up { animation-delay:120ms; }
    @media (min-width: 640px) {
      .hero-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr); align-items:end; gap:1.15rem; }
      .metric-panel { padding:0.8rem 0.92rem; }
      .metric-value { font-size:0.98rem; }
    }
    @keyframes heroEnter {
      from { opacity:0; transform:translateY(18px); }
      to { opacity:1; transform:translateY(0); }
    }
    @keyframes orbPulse {
      0%,100% { box-shadow:0 0 0 rgba(0,255,136,0.04), 0 0 0 rgba(0,255,136,0.02); }
      50% { box-shadow:0 0 20px rgba(0,255,136,0.12), 0 0 36px rgba(0,255,136,0.05); }
    }
    @keyframes feedbackRise {
      0% { opacity:0; transform:translateY(14px) scale(0.96); }
      18% { opacity:1; }
      100% { opacity:0; transform:translateY(-12px) scale(1); }
    }
  `],
})
export class HomeRankingCardComponent implements OnDestroy {
  currentRank = input(0);
  previousRank = input<number | null>(null);
  recentDelta = input(0);
  totalXp = input(0);
  streakDays = input(0);
  positionsToClimb = input(0);
  xpToClimb = input(0);
  progressPct = input(0);
  xpDelta = input(0);

  readonly openRanking = output<void>();

  readonly displayedRank = signal(0);
  readonly messageStep = signal(0);
  readonly headline = computed(() => this.currentRank() <= 1 ? 'Você dita o ritmo' : 'Hoje dá para subir');
  readonly previousDisplayRank = computed(() => Math.max(this.previousRank() ?? (this.currentRank() + Math.max(this.recentDelta(), 1)), 1));
  readonly urgencyLine = computed(() => this.positionsToClimb() > 0
    ? `Suba ${this.positionsToClimb()} ${this.positionsToClimb() === 1 ? 'posição' : 'posições'} hoje`
    : 'Segure a liderança hoje');
  readonly progressDetail = computed(() => this.currentRank() <= 1
    ? 'Todo mundo está correndo atrás de você'
    : `${this.progressPct()}% para ultrapassar o próximo`);
  readonly xpNeedLabel = computed(() => this.positionsToClimb() > 0
    ? `Você precisa de +${this.xpToClimb()} XP para subir ${this.positionsToClimb()} ${this.positionsToClimb() === 1 ? 'posição' : 'posições'}`
    : 'Liderança mantida. Continue empilhando XP.');
  readonly variationLabel = computed(() => {
    const delta = this.recentDelta();
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `${delta}`;
    return 'estável';
  });

  private rankTimer: ReturnType<typeof setInterval> | null = null;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.currentRank();
      this.previousRank();
      this.positionsToClimb();
      this.xpDelta();
      this.recentDelta();
      this.startRankAnimation();
      this.startMessageAnimation();
    });
  }

  ngOnDestroy(): void {
    if (this.rankTimer) clearInterval(this.rankTimer);
    if (this.messageTimer) clearTimeout(this.messageTimer);
  }

  private startRankAnimation(): void {
    if (this.rankTimer) clearInterval(this.rankTimer);

    const target = Math.max(this.currentRank(), 1);
    const start = Math.max(this.previousRank() ?? (target + 9), 1);
    this.displayedRank.set(start);

    if (start === target) return;

    const direction = target < start ? -1 : 1;
    const totalSteps = Math.max(Math.abs(start - target), 1);
    const interval = Math.max(22, Math.floor(540 / totalSteps));

    this.rankTimer = setInterval(() => {
      const next = this.displayedRank() + direction;
      this.displayedRank.set(next);
      if (next === target && this.rankTimer) {
        clearInterval(this.rankTimer);
        this.rankTimer = null;
      }
    }, interval);
  }

  private startMessageAnimation(): void {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageStep.set(0);
    this.messageTimer = setTimeout(() => this.messageStep.set(1), 1100);
  }
}
