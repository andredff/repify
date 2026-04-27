import { Component, inject, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WalkService } from '../../../core/services/walk.service';

@Component({
  selector: 'app-walk-card',
  standalone: true,
  template: `
    <div class="relative overflow-hidden rounded-2xl border border-border bg-card-2">

      <!-- Background glow -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute -bottom-8 -right-8 w-40 h-40 rounded-full"
             style="background:radial-gradient(circle,rgba(0,255,136,0.06) 0%,transparent 70%)"></div>
      </div>

      <div class="relative flex items-center gap-4 px-4 py-4">

        <!-- Icon -->
        <div class="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center text-2xl shrink-0">
          🚶
        </div>

        <!-- Text -->
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-body font-semibold text-white leading-snug">{{ title() }}</p>
          <p class="text-[11px] font-body text-text-2 mt-0.5">
            @if (walk.isActive()) {
              {{ statusLine() }}
            } @else if (walk.totalWalks() > 0) {
              {{ walk.totalWalks() }} caminhada{{ walk.totalWalks() > 1 ? 's' : '' }} registrada{{ walk.totalWalks() > 1 ? 's' : '' }}
              @if (walk.totalKm() > 0) {
                · {{ walk.totalKm() | number:'1.1-1' }} km total
              }
            } @else {
              Manual ou com GPS · conta pro streak
            }
          </p>
        </div>

        <!-- CTA -->
        <button (click)="onStart.emit()"
                class="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-body font-bold transition-all"
                [class]="walk.isActive()
                  ? 'border border-primary/30 bg-primary/12 text-primary hover:bg-primary/18 active:scale-95'
                  : 'bg-primary text-bg shadow-glow hover:shadow-glow-lg active:scale-95'">
          @if (walk.isActive()) {
            <span class="inline-flex h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(0,255,136,0.6)] animate-pulse"></span>
            Caminhando
          } @else {
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Iniciar caminhada
          }
        </button>

      </div>
    </div>
  `,
  imports: [DecimalPipe],
})
export class WalkCardComponent {
  walk    = inject(WalkService);
  onStart = output<void>();

  title(): string {
    if (this.walk.activePhase() === 'running') return 'Caminhada em andamento';
    if (this.walk.activePhase() === 'paused') return 'Caminhada pausada';
    return 'Registrar caminhada';
  }

  statusLine(): string {
    if (this.walk.activePhase() === 'paused') {
      return `Pausada em ${this.walk.formattedTime()}${this.walk.liveKm() > 0 ? ' · ' + this.walk.liveKm().toFixed(1) + ' km' : ''}`;
    }

    return `Caminhando há ${this.walk.formattedTime()}${this.walk.liveKm() > 0 ? ' · ' + this.walk.liveKm().toFixed(1) + ' km' : ''}`;
  }
}
