import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

const TIPS: string[] = [
  'Comece pequeno — aparecer já é vencer.',
  'Treine no mesmo horário todos os dias.',
  'Não negocie com a preguiça — vá mesmo sem vontade.',
  'Deixe sua roupa de treino pronta antes.',
  'Crie um ritual pré-treino (música, café, foco).',
  'Pare de depender de motivação — construa disciplina.',
  'Registre seu treino (check-in, app, foto).',
  'Foque em constância, não perfeição.',
  'Treino ruim ainda é melhor que nenhum treino.',
  'Tenha um plano — não improvise todo dia.',
  'Durma bem — sem recuperação não há evolução.',
  'Evite faltar 2 dias seguidos.',
  'Celebre pequenas vitórias.',
  'Tenha um objetivo claro (força, estética, saúde).',
  'Não se compare — compare-se com ontem.',
  'Tenha um treino "mínimo" para dias difíceis.',
  'Cuidado com exageros — consistência > intensidade.',
  'Treine mesmo sem energia — ajuste, mas vá.',
  'Construa o hábito no automático.',
  'Ambiente importa — deixe tudo fácil pra ir.',
  'Use a regra dos 5 minutos: comece, o resto vem.',
  'Tenha dias fixos de treino na semana.',
  'Não espere a segunda-feira — comece hoje.',
  'Tenha um parceiro ou comunidade.',
  'Alinhe alimentação com seu objetivo.',
  'Lembre-se do porquê você começou.',
  'Consistência cria identidade: "eu treino".',
  'Adapte, mas não pare.',
  'Disciplina é fazer mesmo sem vontade.',
  'Você não precisa ser perfeito, só constante.',
];

const DISMISS_KEY = 'repify_consistency_tip_dismissed';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentTip(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return TIPS[dayOfYear % TIPS.length];
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayKey();
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-consistency-tip-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes tip-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .tip-enter {
      animation: tip-in 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
  `],
  template: `
    @if (visible()) {
      <div class="tip-enter relative overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">

        <!-- subtle glow blob -->
        <div class="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
             style="background: radial-gradient(circle, rgba(0,255,136,0.12), transparent 70%)"></div>

        <!-- header row -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-[12px]">✦</span>
            <span class="text-[10px] font-body font-semibold uppercase tracking-[0.2em] text-primary/80">Motivacional do dia</span>
          </div>

          <button
            type="button"
            (click)="dismiss()"
            aria-label="Fechar"
            class="flex h-6 w-6 items-center justify-center rounded-full text-white/25 transition-colors hover:text-white/60 active:scale-90">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- quote -->
        <p class="text-[15px] font-display font-bold leading-snug text-white">
          {{ tip() }}
        </p>

        <!-- bottom line accent -->
        <div class="mt-3.5 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent"></div>

      </div>
    }
  `,
})
export class ConsistencyTipCardComponent {
  dismissed = output<void>();

  readonly tip     = signal(currentTip());
  readonly visible = signal(!isDismissed());

  dismiss(): void {
    try { localStorage.setItem(DISMISS_KEY, todayKey()); } catch { /* noop */ }
    this.visible.set(false);
    this.dismissed.emit();
  }
}
