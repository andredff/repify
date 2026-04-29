import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-weekly-goal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative overflow-hidden rounded-[22px] border px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.2)]"
             [class]="isCompleted() ? 'border-primary/30 bg-[linear-gradient(180deg,rgba(8,20,16,0.96),rgba(8,12,16,1))]' : 'border-border bg-[linear-gradient(180deg,rgba(10,17,23,0.96),rgba(8,12,16,1))]'">
      <div class="absolute inset-0 opacity-90" [style.background]="backdropGradient()"></div>
      <div class="relative z-[1] space-y-2.5">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 flex items-center gap-2.5">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] border border-primary/15 bg-primary/10 text-[15px] shadow-[0_0_16px_rgba(0,255,136,0.08)]">{{ heroEmoji() }}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-[10px] font-body uppercase tracking-[0.18em] text-primary/70">Meta semanal</p>
                <span class="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-body font-semibold uppercase tracking-[0.12em]"
                      [class]="isCompleted() ? 'border-primary/20 bg-primary/12 text-primary' : 'border-white/10 bg-white/[0.04] text-text-2'">
                  {{ badgeLabel() }}
                </span>
              </div>
              <p class="mt-0.5 truncate text-[11px] font-body text-text-2">{{ compactStatusLabel() }}</p>
            </div>
          </div>

          <div class="shrink-0 text-right">
            <p class="text-[26px] font-display font-bold leading-none tracking-tight text-white">{{ completedDays() }}/{{ goalDays() }}</p>
            <p class="mt-0.5 text-[10px] font-body text-text-2">+{{ rewardXp() }} XP</p>
          </div>
        </div>

        <div class="rounded-[18px] border border-primary/5 bg-white/[0.03] px-2.5 py-2">
          <div class="flex items-center justify-between gap-3 text-[10px] font-body">
            <div class="flex items-center gap-1.5">
              @for (slot of daySlots(); track slot.index) {
                <span class="h-2 w-2 rounded-full border transition-all"
                      [class]="slot.filled ? 'border-primary/40 bg-primary shadow-[0_0_8px_rgba(0,255,136,0.45)]' : 'border-white/10 bg-white/[0.06]'">
                </span>
              }
              <span class="ml-1 text-text-2">{{ weekLabel() }}</span>
            </div>
            <span class="font-semibold" [class]="isCompleted() ? 'text-primary' : 'text-white'">{{ progressPct() }}%</span>
          </div>

          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div class="h-full rounded-full transition-all duration-500" [style.width.%]="progressPct()" [style.background]="progressGradient()"></div>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class WeeklyGoalCardComponent {
  goalDays = input(4);
  completedDays = input(0);
  remainingDays = input(0);
  progressPct = input(0);
  rewardXp = input(0);
  isCompleted = input(false);
  isRewardClaimed = input(false);
  currentStreak = input(0);
  weekLabel = input('');
  statusLabel = input('');

  readonly headline = computed(() => {
    if (this.isRewardClaimed()) return 'Meta concluída';
    if (this.isCompleted()) return 'Recompensa liberada';
    return 'Siga constante';
  });

  readonly badgeLabel = computed(() => this.isRewardClaimed() ? 'Concluída' : this.isCompleted() ? 'Fechada' : 'Em andamento');
  readonly heroEmoji = computed(() => this.isRewardClaimed() ? '🏆' : this.isCompleted() ? '✅' : '📆');
  readonly compactStatusLabel = computed(() => {
    if (this.isRewardClaimed()) {
      return 'Bônus semanal já aplicado.';
    }

    if (this.isCompleted()) {
      return `Meta fechada com +${this.rewardXp()} XP nesta semana.`;
    }

    return `Faltam ${this.remainingDays()} dia${this.remainingDays() === 1 ? '' : 's'} para bater a meta.`;
  });
  readonly helperLabel = computed(() => this.isCompleted()
    ? 'Seu bônus semanal já entrou na conta.'
    : `Faltam ${this.remainingDays()} dia${this.remainingDays() === 1 ? '' : 's'} para bater a meta.`);
  readonly progressGradient = computed(() => this.isCompleted()
    ? 'linear-gradient(90deg, rgba(0,255,136,0.95), rgba(0,194,255,0.9))'
    : 'linear-gradient(90deg, rgba(0,255,136,0.88), rgba(0,255,136,0.42))');
  readonly backdropGradient = computed(() => this.isCompleted()
    ? 'radial-gradient(circle at top right, rgba(0,255,136,0.12), transparent 42%), radial-gradient(circle at bottom left, rgba(0,194,255,0.12), transparent 36%)'
    : 'radial-gradient(circle at top right, rgba(0,255,136,0.1), transparent 38%), radial-gradient(circle at bottom left, rgba(255,255,255,0.05), transparent 32%)');
  readonly daySlots = computed(() => Array.from({ length: this.goalDays() }, (_, index) => ({
    index: index + 1,
    filled: index < this.completedDays(),
  })));
}
