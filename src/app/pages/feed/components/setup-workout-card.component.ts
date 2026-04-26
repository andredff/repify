import { Component, output } from '@angular/core';

@Component({
  selector: 'app-setup-workout-card',
  standalone: true,
  template: `
    <div class="relative bg-card-2 border border-primary/20 rounded-2xl overflow-hidden p-4">

      <!-- Background glow -->
      <div class="absolute -top-6 -right-6 w-32 h-32 rounded-full blur-2xl pointer-events-none"
           style="background: radial-gradient(circle, #00FF8814, transparent 70%)"></div>

      <div class="relative flex items-center gap-4">

        <!-- Icon -->
        <div class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
          </svg>
        </div>

        <!-- Text -->
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-body font-semibold text-white leading-tight">Monte seu programa</p>
          <p class="text-[11px] font-body text-text-2 mt-0.5 leading-snug">Crie seu plano de treino e acompanhe sua evolução.</p>
        </div>

        <!-- CTA -->
        <button
          (click)="onSetup.emit()"
          class="shrink-0 px-3 py-2 bg-primary text-bg rounded-xl text-[12px] font-body font-bold shadow-glow-sm active:scale-95 transition-transform">
          Montar
        </button>

      </div>
    </div>
  `,
})
export class SetupWorkoutCardComponent {
  onSetup = output<void>();
}
