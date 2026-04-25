import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkoutService } from '../../core/services/workout.service';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  done: boolean;
}

interface WorkoutPlan {
  id: string;
  name: string;
  muscleGroup: string;
  exercises: Exercise[];
}

const WORKOUT_PLANS: Record<string, WorkoutPlan> = {
  'peito-triceps': {
    id: 'peito-triceps',
    name: 'Peito + Tríceps',
    muscleGroup: 'peito',
    exercises: [
      { id: '1', name: 'Supino reto',        sets: 4, reps: '8-10 reps', done: false },
      { id: '2', name: 'Supino inclinado',   sets: 4, reps: '8-10 reps', done: false },
      { id: '3', name: 'Crucifixo máquina',  sets: 3, reps: '12 reps',   done: false },
      { id: '4', name: 'Desenvolvimento',    sets: 3, reps: '10 reps',   done: false },
      { id: '5', name: 'Tríceps corda',      sets: 3, reps: '12 reps',   done: false },
      { id: '6', name: 'Tríceps testa',      sets: 3, reps: '12 reps',   done: false },
    ],
  },
  'costas-biceps': {
    id: 'costas-biceps',
    name: 'Costas + Bíceps',
    muscleGroup: 'costas',
    exercises: [
      { id: '1', name: 'Puxada frente',    sets: 4, reps: '10 reps', done: false },
      { id: '2', name: 'Remada curvada',   sets: 3, reps: '10 reps', done: false },
      { id: '3', name: 'Remada unilateral',sets: 3, reps: '12 reps', done: false },
      { id: '4', name: 'Rosca direta',     sets: 3, reps: '12 reps', done: false },
      { id: '5', name: 'Rosca martelo',    sets: 3, reps: '12 reps', done: false },
    ],
  },
  'pernas': {
    id: 'pernas',
    name: 'Pernas',
    muscleGroup: 'pernas',
    exercises: [
      { id: '1', name: 'Agachamento',        sets: 5, reps: '8 reps',  done: false },
      { id: '2', name: 'Leg press',           sets: 4, reps: '12 reps', done: false },
      { id: '3', name: 'Cadeira extensora',   sets: 3, reps: '15 reps', done: false },
      { id: '4', name: 'Mesa flexora',        sets: 3, reps: '12 reps', done: false },
      { id: '5', name: 'Panturrilha em pé',   sets: 4, reps: '20 reps', done: false },
    ],
  },
};

@Component({
  selector: 'app-workout',
  standalone: true,
  template: `
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto">

      <!-- Header -->
      <header class="glass border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button (click)="location.back()"
                class="flex items-center gap-2 text-text-2 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span class="text-[14px] font-body font-medium">Treino</span>
        </button>
        <button class="text-text-2 hover:text-white transition-colors p-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </header>

      <!-- Content -->
      <main class="flex-1 px-4 pt-6 pb-32 overflow-y-auto">

        @if (plan()) {

          <!-- Title + progress -->
          <h1 class="text-[28px] font-display font-bold text-white leading-tight mb-1">
            {{ plan()!.name }}
          </h1>

          <div class="flex items-center justify-between mb-3">
            <span class="text-[13px] font-body text-text-2">
              {{ doneCount() }}/{{ plan()!.exercises.length }} exercícios concluídos
            </span>
            <span class="text-[13px] font-mono font-semibold text-primary">
              {{ progressPct() }}%
            </span>
          </div>

          <!-- Progress bar -->
          <div class="h-1.5 bg-card-2 rounded-full mb-8 overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all duration-500 shadow-glow-sm"
                 [style.width]="progressPct() + '%'"></div>
          </div>

          <!-- Exercise list -->
          <div class="space-y-3">
            @for (ex of exercises(); track ex.id; let i = $index) {
              <button
                (click)="toggleExercise(ex.id)"
                class="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left"
                [class]="ex.done
                  ? 'bg-primary/8 border-primary/30'
                  : 'bg-card-2 border-border hover:border-border-2'">

                <!-- Number / check -->
                <div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all"
                     [class]="ex.done
                       ? 'bg-primary border-primary'
                       : 'bg-card border-border'">
                  @if (ex.done) {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  } @else {
                    <span class="text-[12px] font-mono font-bold text-text-2">{{ i + 1 }}</span>
                  }
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p class="text-[15px] font-body font-semibold transition-colors"
                     [class]="ex.done ? 'text-text-2 line-through' : 'text-white'">
                    {{ ex.name }}
                  </p>
                  <p class="text-[12px] font-body text-text-2 mt-0.5">
                    {{ ex.sets }} séries x {{ ex.reps }}
                  </p>
                </div>

                <!-- Ring indicator (pending) -->
                @if (!ex.done) {
                  <div class="shrink-0 w-6 h-6 rounded-full border-2 border-primary/40 flex items-center justify-center">
                    <div class="w-2 h-2 rounded-full bg-primary/40"></div>
                  </div>
                }
              </button>
            }
          </div>

        } @else {
          <div class="flex flex-col items-center justify-center h-64 text-center">
            <p class="text-text-2 font-body text-[14px]">Treino não encontrado.</p>
          </div>
        }

      </main>

      <!-- Sticky bottom CTA -->
      @if (plan()) {
        <div class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-8 pt-4 glass border-t border-border">
          @if (allDone()) {
            <button (click)="finishWorkout()"
                    class="w-full py-4 rounded-2xl bg-primary text-bg font-display font-bold text-[16px] shadow-glow hover:shadow-glow-lg active:scale-[0.98] transition-all animate-fade-in">
              Finalizar treino ✓
            </button>
          } @else {
            <button (click)="finishWorkout()"
                    class="w-full py-4 rounded-2xl bg-primary text-bg font-display font-bold text-[16px] shadow-glow hover:shadow-glow-lg active:scale-[0.98] transition-all">
              Finalizar treino
            </button>
          }
        </div>
      }

    </div>
  `,
})
export class WorkoutComponent implements OnInit {
  location        = inject(Location);
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private workoutService = inject(WorkoutService);

  exercises = signal<Exercise[]>([]);
  plan      = signal<WorkoutPlan | null>(null);

  doneCount   = computed(() => this.exercises().filter(e => e.done).length);
  progressPct = computed(() => {
    const total = this.exercises().length;
    return total === 0 ? 0 : Math.round((this.doneCount() / total) * 100);
  });
  allDone = computed(() => this.exercises().length > 0 && this.doneCount() === this.exercises().length);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    // Look in static plans first, then in dynamically registered plans
    const staticPlan = WORKOUT_PLANS[id] ?? null;
    const dynamicPlan = staticPlan ? null : this.workoutService.getPlan(id);
    const found = staticPlan ?? dynamicPlan ?? null;
    this.plan.set(found);
    this.exercises.set(found ? found.exercises.map(e => ({ ...e })) : []);
  }

  toggleExercise(id: string): void {
    this.exercises.update(list =>
      list.map(e => e.id === id ? { ...e, done: !e.done } : e)
    );
  }

  finishWorkout(): void {
    const id = this.plan()?.id;
    if (id) this.workoutService.markFinished(id);
    this.router.navigateByUrl('/feed');
  }
}
