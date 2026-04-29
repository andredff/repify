import { Component, computed, input, output } from '@angular/core';
import { WorkoutAvailabilityState } from '../../../core/services/workout.service';

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
    <div class="rounded-[22px] overflow-hidden shadow-card relative border transition-colors"
         [class]="isFinished() ? 'bg-primary/5 border-primary/30' : isLocked() ? 'bg-card/80 border-border' : 'bg-card-2 border-border'">

      <!-- Glow accent top -->
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
           [class]="isFinished() ? 'opacity-100' : isLocked() ? 'opacity-20' : 'opacity-60'"></div>

      <!-- Decorative emoji bg -->
      <div class="absolute right-3 top-1/2 -translate-y-1/2 text-[58px] opacity-[0.05] select-none pointer-events-none font-display font-black">
        {{ emoji() }}
      </div>

      <div class="relative px-3.5 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-2">
          @if (isFinished()) {
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-[0.16em]">Treino concluído</span>
          } @else if (isInProgress()) {
            <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-[0.16em]">Treino em andamento</span>
          } @else if (isLocked()) {
            <div class="w-1.5 h-1.5 rounded-full bg-text-2/40"></div>
            <span class="text-[10px] font-body font-semibold text-text-2 uppercase tracking-[0.16em]">Acesso bloqueado</span>
          } @else {
            <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-[0.16em]">Treino de hoje</span>
          }
            </div>

            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
            <h3 class="text-[18px] font-display font-bold leading-tight truncate"
                [class]="isFinished() || isLocked() ? 'text-text-2' : 'text-white'">
              {{ workout().name }}
            </h3>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-body text-text-2">
              <span class="flex items-center gap-1 whitespace-nowrap">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {{ workout().estimatedDuration }} min
              </span>
              <span class="h-3 w-px bg-border"></span>
              <span class="flex items-center gap-1 whitespace-nowrap">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                  <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
                {{ workout().totalExercises }} exercícios
              </span>
              <span class="h-3 w-px bg-border"></span>
              <span class="whitespace-nowrap text-[10px] font-body font-semibold" [class]="difficultyClass()">
                {{ workout().difficulty }}
              </span>
            </div>
          </div>

          <div class="shrink-0 pl-2">
          @if (isFinished()) {
            <div class="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/15 px-3 py-2 text-[12px] font-body font-semibold text-primary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {{ ctaLabel() }}
            </div>
          } @else {
            <button
              type="button"
              (click)="onStart.emit(workout().id)"
              [disabled]="isLocked()"
              class="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-body font-bold transition-all"
              [class]="isLocked()
                ? 'bg-card border border-border text-text-2 cursor-not-allowed opacity-80'
                : isInProgress()
                  ? 'bg-primary/12 border border-primary/30 text-primary shadow-glow-sm hover:bg-primary/18 active:scale-95'
                  : 'bg-primary text-bg shadow-glow hover:shadow-glow-lg active:scale-95'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              {{ ctaLabel() }}
            </button>
          }
        </div>
          </div>
          </div>

      </div>
    </div>
  `,
})
export class DailyWorkoutCardComponent {
  workout  = input.required<DailyWorkout>();
  state = input<WorkoutAvailabilityState>('pending');
  onStart  = output<string>();

  readonly isFinished = computed(() => this.state() === 'completed');
  readonly isLocked = computed(() => this.state() === 'locked');
  readonly isInProgress = computed(() => this.state() === 'in_progress');
  readonly ctaLabel = computed(() => {
    if (this.isLocked()) return '🔒 Disponível amanhã';
    if (this.isInProgress()) return 'Continuar';
    if (this.isFinished()) return 'Feito!';
    return 'Iniciar';
  });

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
