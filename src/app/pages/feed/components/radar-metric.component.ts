import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-radar-metric',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="rounded-2xl border border-white/6 bg-white/[0.02] px-3.5 py-3.5 min-h-[92px]">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-[10px] font-body uppercase tracking-[0.16em] text-text-2">{{ label() }}</p>
          <p class="mt-2 text-[18px] font-display font-bold leading-none text-white sm:text-[19px]"
             [class.text-primary]="highlight() && !negative()"
             [class.text-danger]="negative()">
            {{ value() }}
          </p>
        </div>
        @if (badge()) {
          <span class="shrink-0 rounded-full border px-2 py-1 text-[10px] font-body font-semibold"
                [class]="badgeClass()">
            {{ badge() }}
          </span>
        }
      </div>
      @if (caption()) {
        <p class="mt-3 text-[11px] font-body leading-4 text-text-2">{{ caption() }}</p>
      }
    </article>
  `,
})
export class RadarMetricComponent {
  label = input('Métrica');
  value = input('0');
  caption = input('');
  badge = input('');
  highlight = input(false);
  negative = input(false);

  readonly badgeClass = computed(() => {
    if (this.negative()) {
      return 'border-danger/20 bg-danger/10 text-danger';
    }
    if (this.highlight()) {
      return 'border-primary/20 bg-primary/10 text-primary';
    }
    return 'border-white/8 bg-white/[0.03] text-text-2';
  });
}
