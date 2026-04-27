import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-ranking-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-body uppercase tracking-[0.2em] text-text-2">Pressão no ranking</p>
          <p class="mt-1 text-[12px] font-body font-semibold leading-5 text-white sm:text-[13px]">{{ progressLabel() }}</p>
        </div>
        <p class="shrink-0 text-[10px] font-mono text-primary sm:text-[11px]">{{ clampedProgress() }}%</p>
      </div>

      <div class="relative h-2.5 overflow-hidden rounded-full border border-white/8 bg-white/[0.05]">
        <div class="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(0,255,136,0.26),rgba(0,255,136,0.92))] shadow-[0_0_18px_rgba(0,255,136,0.2)] transition-all duration-700"
             [style.width.%]="clampedProgress()"></div>
        <div class="absolute inset-y-[2px] w-6 rounded-full bg-white/25 blur-md transition-all duration-700"
             [style.left.%]="glowPosition()"></div>
      </div>

      <div class="flex items-center justify-between gap-3 text-[10px] font-body text-text-2 sm:text-[11px]">
        <span>Você</span>
        <span class="text-right">{{ detailLabel() }}</span>
      </div>
    </div>
  `,
})
export class RankingProgressBarComponent {
  progress = input(0);
  progressLabel = input('Você está aquecendo para subir');
  detailLabel = input('Próxima posição no radar');

  readonly clampedProgress = computed(() => Math.max(0, Math.min(100, Math.round(this.progress()))));
  readonly glowPosition = computed(() => Math.max(0, Math.min(92, this.clampedProgress() - 6)));
}
