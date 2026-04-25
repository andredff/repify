import { Component, input, output } from '@angular/core';

export interface DailyWorkout {
  id: string;
  name: string;
  muscleGroup: string;
  totalExercises: number;
  estimatedDuration: number;
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
}

const MUSCLE_EMOJI: Record<string, string> = {
  peito:   '🫁',
  costas:  '🔙',
  pernas:  '🦵',
  ombros:  '💪',
  biceps:  '💪',
  triceps: '🤜',
  abdomen: '⚡',
  full:    '🔥',
};

@Component({
  selector: 'app-daily-workout-card',
  standalone: true,
  template: `
    <div class="rounded-2xl overflow-hidden shadow-card relative border transition-colors"
         [class]="finished() ? 'bg-primary/5 border-primary/30' : 'bg-card-2 border-border'">

      <!-- Glow accent top -->
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
           [class]="finished() ? 'opacity-100' : 'opacity-60'"></div>

      <!-- Decorative emoji bg -->
      <div class="absolute right-4 top-1/2 -translate-y-1/2 text-[72px] opacity-[0.06] select-none pointer-events-none font-display font-black">
        {{ emoji() }}
      </div>

      <div class="relative px-4 py-4">

        <!-- Label -->
        <div class="flex items-center gap-2 mb-3">
          @if (finished()) {
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-widest">Treino concluído</span>
          } @else {
            <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-widest">Treino de hoje</span>
          }
        </div>

        <!-- Workout name + meta -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <h3 class="text-[20px] font-display font-bold leading-tight truncate"
                [class]="finished() ? 'text-text-2' : 'text-white'">
              {{ workout().name }}
            </h3>
            <div class="flex items-center gap-3 mt-1.5">
              <span class="flex items-center gap-1 text-[11px] font-body text-text-2">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {{ workout().estimatedDuration }} min
              </span>
              <span class="w-px h-3 bg-border"></span>
              <span class="flex items-center gap-1 text-[11px] font-body text-text-2">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                  <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
                {{ workout().totalExercises }} exercícios
              </span>
              <span class="w-px h-3 bg-border"></span>
              <span class="text-[11px] font-body" [class]="difficultyClass()">
                {{ workout().difficulty }}
              </span>
            </div>
          </div>

          <!-- CTA button -->
          @if (finished()) {
            <div class="shrink-0 flex items-center gap-2 bg-primary/15 border border-primary/30 text-primary font-body font-semibold text-[13px] px-4 py-2.5 rounded-xl">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Feito!
            </div>
          } @else {
            <button
              (click)="onStart.emit(workout().id)"
              class="shrink-0 flex items-center gap-2 bg-primary text-bg font-body font-bold text-[13px] px-4 py-2.5 rounded-xl shadow-glow hover:shadow-glow-lg active:scale-95 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Iniciar
            </button>
          }
        </div>

      </div>
    </div>
  `,
})
export class DailyWorkoutCardComponent {
  workout  = input.required<DailyWorkout>();
  finished = input<boolean>(false);
  onStart  = output<string>();

  emoji() {
    return MUSCLE_EMOJI[this.workout().muscleGroup] ?? '💪';
  }

  difficultyClass() {
    const d = this.workout().difficulty;
    if (d === 'Avançado')      return 'text-danger';
    if (d === 'Intermediário') return 'text-secondary';
    return 'text-primary';
  }
}
