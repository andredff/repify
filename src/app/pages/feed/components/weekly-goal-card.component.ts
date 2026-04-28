import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-weekly-goal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative overflow-hidden rounded-[28px] border p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
             [class]="isCompleted() ? 'border-primary/35 bg-[linear-gradient(180deg,rgba(8,20,16,0.98),rgba(8,12,16,1))]' : 'border-border bg-[linear-gradient(180deg,rgba(10,17,23,0.98),rgba(8,12,16,1))]'">
      <div class="absolute inset-0 opacity-90" [style.background]="backdropGradient()"></div>
      <div class="relative z-[1] space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1.5">
            <p class="text-[10px] font-body uppercase tracking-[0.24em] text-primary/70">Meta da semana</p>
            <div class="flex items-end gap-3">
              <div class="flex h-[62px] w-[62px] items-center justify-center rounded-[20px] border border-primary/15 bg-primary/10 shadow-[0_0_24px_rgba(0,255,136,0.08)]">
                <span class="text-[24px]">{{ heroEmoji() }}</span>
              </div>
              <div class="pb-0.5">
                <p class="text-[28px] font-display font-bold leading-none tracking-tight text-white">{{ completedDays() }}/{{ goalDays() }}</p>
                <p class="mt-1 text-[12px] font-body text-text-2">dias treinados · {{ weekLabel() }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-full border px-3 py-1 text-[10px] font-body font-semibold uppercase tracking-[0.18em]"
               [class]="isCompleted() ? 'border-primary/25 bg-primary/12 text-primary' : 'border-white/10 bg-white/[0.04] text-text-2'">
            {{ badgeLabel() }}
          </div>
        </div>

        <div class="grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-2">
          @for (slot of daySlots(); track slot.index) {
            <div class="rounded-2xl border px-3 py-2 text-center transition-all"
                 [class]="slot.filled
                   ? 'border-primary/30 bg-primary/12 shadow-[0_0_18px_rgba(0,255,136,0.08)]'
                   : 'border-primary/5 bg-primary/[0.03]'">
              <p class="text-[9px] font-body uppercase tracking-[0.16em]" [class]="slot.filled ? 'text-primary/80' : 'text-text-2/70'">Dia {{ slot.index }}</p>
              <p class="mt-1 text-[15px] font-display font-bold" [class]="slot.filled ? 'text-white' : 'text-text-2/75'">{{ slot.filled ? '✓' : '•' }}</p>
            </div>
          }
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-[11px] font-body">
            <span class="text-text-2">Progresso</span>
            <span class="font-semibold" [class]="isCompleted() ? 'text-primary' : 'text-white'">{{ progressPct() }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div class="h-full rounded-full transition-all duration-500" [style.width.%]="progressPct()" [style.background]="progressGradient()"></div>
          </div>
        </div>

        <div class="rounded-2xl border border-primary/5 bg-primary/[0.03] p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[13px] font-display font-bold text-white">{{ headline() }}</p>
              <p class="mt-1 text-[11px] font-body leading-relaxed text-text-2">{{ statusLabel() }}</p>
            </div>
            <div class="rounded-xl border border-primary/15 bg-primary/10 px-3 py-2 text-right">
              <p class="text-[9px] font-body uppercase tracking-[0.16em] text-primary/75">Recompensa</p>
              <p class="mt-1 text-[15px] font-display font-bold text-primary">+{{ rewardXp() }} XP</p>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between gap-3 text-[11px] font-body">
            <span class="rounded-full border border-primary/5 bg-white/[0.03] px-3 py-1.5 text-text-2">{{ helperLabel() }}</span>
            <span class="rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 font-semibold text-primary">
              {{ currentStreak() }} semana{{ currentStreak() === 1 ? '' : 's' }} seguidas
            </span>
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
