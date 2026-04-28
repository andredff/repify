import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-workout-completion-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative overflow-hidden rounded-[30px] border border-primary/25 bg-[radial-gradient(circle_at_top,rgba(0,255,136,0.14),transparent_42%),linear-gradient(180deg,rgba(10,17,23,1),rgba(6,10,14,1))] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:px-6 sm:py-7">
      <div class="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent"></div>
      <div class="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl"></div>

      <div class="relative space-y-6">
        <div class="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-body font-semibold uppercase tracking-[0.28em] text-primary">
          <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
          Repify concluido
        </div>

        <div class="space-y-3">
          <p class="text-[30px] font-display font-black leading-none tracking-tight text-white sm:text-[34px]">
            🔥 Treino finalizado
          </p>
          <p class="max-w-[28ch] text-[14px] font-body leading-relaxed text-text-2 sm:text-[15px]">
            Hoje voce venceu. Disciplina nao negocia. Amanhã tem mais.
          </p>
        </div>

        <div class="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p class="text-[11px] font-body uppercase tracking-[0.22em] text-text-2">Frase do dia</p>
          <p class="mt-2 text-[19px] font-display font-bold leading-tight tracking-tight text-white">
            {{ quote() }}
          </p>
          @if (completedAt()) {
            <p class="mt-3 text-[11px] font-mono text-primary/80">concluido em {{ completedAtLabel() }}</p>
          }
        </div>

        <div class="space-y-3">
          <button type="button"
                  (click)="createPost.emit()"
                  class="w-full rounded-2xl border border-primary/30 bg-primary px-4 py-3.5 text-[14px] font-display font-black text-bg transition-all hover:shadow-glow active:scale-[0.98]">
            Adicionar foto e postar desafio
          </button>

          <p class="text-center text-[11px] font-body text-text-2">
            Monte a postagem com os dados reais do treino e leve o desafio pro feed.
          </p>

          <div class="grid gap-3 sm:grid-cols-2">
          <button type="button"
                  (click)="viewProgress.emit()"
                  class="rounded-2xl border border-primary/25 bg-primary/12 px-4 py-3 text-[14px] font-display font-bold text-primary transition-all hover:bg-primary/18 active:scale-[0.98]">
            Ver progresso
          </button>
          <button type="button"
                  (click)="backToFeed.emit()"
                  class="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] font-display font-bold text-white transition-all hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.98]">
            Voltar ao feed
          </button>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class WorkoutCompletionStateComponent {
  quote = input.required<string>();
  completedAt = input<string | null>(null);

  readonly createPost = output<void>();
  readonly viewProgress = output<void>();
  readonly backToFeed = output<void>();

  completedAtLabel(): string {
    const value = this.completedAt();
    if (!value) return '';

    const date = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
