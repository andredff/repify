import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-daily-challenge-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative overflow-hidden rounded-[28px] border border-primary/20 bg-[linear-gradient(180deg,rgba(10,17,23,0.98),rgba(8,12,16,1))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <div class="pointer-events-none absolute -right-10 top-[-36px] h-32 w-32 rounded-full bg-primary/10 blur-3xl"></div>
      <div class="pointer-events-none absolute bottom-[-34px] left-[-10px] h-24 w-24 rounded-full bg-white/5 blur-2xl"></div>
      <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,136,0.5),transparent)]"></div>

      <div class="relative space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-body uppercase tracking-[0.28em] text-primary/80">Desafio de hoje</p>
            <h2 class="mt-2 text-[18px] font-display font-bold tracking-tight text-white">{{ title() }}</h2>
            <p class="mt-2 max-w-[30ch] text-[13px] font-body leading-6 text-text-2">{{ description() }}</p>
          </div>
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-[24px] shadow-[0_0_30px_rgba(0,255,136,0.08)]">
            {{ icon() }}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 text-left">
          <div class="rounded-2xl border border-primary/5 bg-primary/[0.03] px-3.5 py-3">
            <p class="text-[10px] font-body uppercase tracking-[0.22em] text-text-2">Recompensa</p>
            <p class="mt-1 text-[15px] font-display font-bold text-white">{{ reward() }}</p>
          </div>
          <div class="rounded-2xl border border-primary/5 bg-primary/[0.05] px-3.5 py-3">
            <p class="text-[10px] font-body uppercase tracking-[0.22em] text-text-2">Impacto</p>
            <p class="mt-1 text-[15px] font-display font-bold text-primary">{{ impact() }}</p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 rounded-2xl border border-primary/5 bg-primary/[0.03] px-3.5 py-3">
          <p class="text-[12px] font-body leading-5 text-text-2">{{ hint() }}</p>
          <button type="button"
                  (click)="action.emit()"
                  class="shrink-0 rounded-full bg-primary px-4 py-2.5 text-[12px] font-body font-bold text-bg shadow-[0_0_26px_rgba(0,255,136,0.24)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0">
            {{ actionLabel() }}
          </button>
        </div>
      </div>
    </section>
  `,
})
export class DailyChallengeCardComponent {
  title = input('Complete 1 treino');
  description = input('Hoje vale agir cedo para ganhar tração no ranking.');
  reward = input('+70 XP estimados');
  impact = input('subida no ranking');
  hint = input('Quem age agora aparece no topo mais rápido.');
  actionLabel = input('Completar agora');
  icon = input('🔥');

  readonly action = output<void>();
}
