import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { WorkoutService, ActiveProgram, StoredPlan, DAY_INDEX_MAP } from '../../core/services/workout.service';
import { BottomNavComponent } from '../feed/components/bottom-nav.component';
import { NewPostModalComponent } from '../feed/components/new-post-modal.component';
import { FeedHeaderComponent } from '../feed/components/feed-header.component';
import { NotificationsPanelComponent } from '../feed/components/notifications-panel.component';

type Step = 'plan' | 'goal' | 'level' | 'days' | 'result';
type Goal = 'hipertrofia' | 'emagrecimento' | 'forca' | 'condicionamento';
type Level = 'iniciante' | 'intermediario' | 'avancado';
type Days = 3 | 4 | 5;

interface WizardState {
  goal:  Goal  | null;
  level: Level | null;
  days:  Days  | null;
}

interface Ex {
  id: string; name: string; sets: number; reps: string; done: boolean;
}

interface GeneratedWorkout {
  id: string;
  name: string;
  muscleGroup: string;
  exercises: Ex[];
  estimatedDuration: number;
  totalExercises: number;
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
  dayLabel: string;
  dayIndex: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANOS COMPLETOS (baseados nas referências)
// ─────────────────────────────────────────────────────────────────────────────

function ex(id: string, name: string, sets: number, reps: string): Ex {
  return { id, name, sets, reps, done: false };
}

// ── INICIANTE — Full Body, alternando A/B ─────────────────────────────────────
const INICIANTE_A: Ex[] = [
  ex('1','Agachamento livre',  3,'10 reps'),
  ex('2','Supino reto',        3,'10 reps'),
  ex('3','Puxada na frente',   3,'10 reps'),
  ex('4','Elevação lateral',   3,'12 reps'),
  ex('5','Abdominal',          3,'15 reps'),
];
const INICIANTE_B: Ex[] = [
  ex('1','Leg press',          3,'10 reps'),
  ex('2','Supino inclinado',   3,'10 reps'),
  ex('3','Remada baixa',       3,'10 reps'),
  ex('4','Rosca direta',       3,'12 reps'),
  ex('5','Prancha',            3,'30 seg'),
];
// Dia extra para 4/5 dias
const INICIANTE_C: Ex[] = [
  ex('1','Afundo',             3,'10 reps cada'),
  ex('2','Flexão de braço',    3,'10 reps'),
  ex('3','Remada unilateral',  3,'12 reps'),
  ex('4','Rosca martelo',      3,'12 reps'),
  ex('5','Abdominal bicicleta',3,'20 reps'),
];
const INICIANTE_D: Ex[] = [
  ex('1','Stiff',              3,'12 reps'),
  ex('2','Supino fechado',     3,'10 reps'),
  ex('3','Puxada triângulo',   3,'12 reps'),
  ex('4','Elevação frontal',   3,'12 reps'),
  ex('5','Prancha lateral',    3,'30 seg cada'),
];
const INICIANTE_E: Ex[] = [
  ex('1','Agachamento sumô',   3,'12 reps'),
  ex('2','Crucifixo máquina',  3,'12 reps'),
  ex('3','Remada curvada',     3,'10 reps'),
  ex('4','Tríceps corda',      3,'12 reps'),
  ex('5','Abdominal',          3,'20 reps'),
];

// ── HIPERTROFIA — Push / Pull / Legs ─────────────────────────────────────────
const HIPER_PUSH: Ex[] = [
  ex('1','Supino reto',        4,'8 reps'),
  ex('2','Supino inclinado',   3,'10 reps'),
  ex('3','Desenvolvimento',    3,'10 reps'),
  ex('4','Tríceps corda',      3,'12 reps'),
  ex('5','Elevação lateral',   3,'12 reps'),
];
const HIPER_PULL: Ex[] = [
  ex('1','Barra fixa',         4,'até falha'),
  ex('2','Puxada alta',        3,'10 reps'),
  ex('3','Remada curvada',     3,'10 reps'),
  ex('4','Rosca direta',       3,'12 reps'),
  ex('5','Rosca martelo',      3,'12 reps'),
];
const HIPER_LEGS: Ex[] = [
  ex('1','Agachamento',        4,'8 reps'),
  ex('2','Leg press',          3,'10 reps'),
  ex('3','Cadeira extensora',  3,'12 reps'),
  ex('4','Mesa flexora',       3,'12 reps'),
  ex('5','Panturrilha em pé',  4,'15 reps'),
];
// Extra para 4/5 dias
const HIPER_PUSH2: Ex[] = [
  ex('1','Supino declinado',   4,'10 reps'),
  ex('2','Crucifixo máquina',  3,'12 reps'),
  ex('3','Crossover',          3,'15 reps'),
  ex('4','Tríceps testa',      3,'12 reps'),
  ex('5','Tríceps francês',    3,'12 reps'),
];
const HIPER_PULL2: Ex[] = [
  ex('1','Puxada triângulo',   4,'10 reps'),
  ex('2','Remada unilateral',  3,'12 reps'),
  ex('3','Pullover',           3,'12 reps'),
  ex('4','Rosca concentrada',  3,'12 reps'),
  ex('5','Rosca 21',           3,'21 reps'),
];

// ── EMAGRECIMENTO — HIIT + Musculação ────────────────────────────────────────
const EMAG_HIIT_A: Ex[] = [
  ex('1','Agachamento + salto', 3,'12 reps'),
  ex('2','Burpee',              3,'10 reps'),
  ex('3','Flexão de braço',     3,'12 reps'),
  ex('4','Corrida (esteira)',   1,'10 min (1min forte/1min leve)'),
  ex('5','Abdominal',           3,'15 reps'),
];
const EMAG_HIIT_B: Ex[] = [
  ex('1','Mountain climber',    3,'30 seg'),
  ex('2','Polichinelo',         3,'40 reps'),
  ex('3','Agachamento sumô',    3,'15 reps'),
  ex('4','Corda (pular)',        4,'1 min'),
  ex('5','Prancha',             3,'45 seg'),
];
const EMAG_MUSC_A: Ex[] = [
  ex('1','Supino reto',         3,'12 reps'),
  ex('2','Puxada alta',         3,'12 reps'),
  ex('3','Agachamento',         3,'15 reps'),
  ex('4','Elevação lateral',    3,'15 reps'),
  ex('5','Abdominal bicicleta', 3,'20 reps'),
];
const EMAG_MUSC_B: Ex[] = [
  ex('1','Leg press',           3,'15 reps'),
  ex('2','Remada curvada',      3,'12 reps'),
  ex('3','Flexão de braço',     3,'15 reps'),
  ex('4','Afundo',              3,'12 reps cada'),
  ex('5','Prancha lateral',     3,'30 seg cada'),
];
const EMAG_CARDIO: Ex[] = [
  ex('1','Corrida contínua',    1,'20 min'),
  ex('2','HIIT sprint',         8,'30 seg forte / 30 seg leve'),
  ex('3','Polichinelo',         3,'50 reps'),
  ex('4','Agachamento livre',   3,'20 reps'),
  ex('5','Abdominal',           3,'20 reps'),
];

// ── FORÇA — Upper / Lower ─────────────────────────────────────────────────────
const FORCA_UPPER: Ex[] = [
  ex('1','Supino reto',         4,'6-8 reps'),
  ex('2','Barra fixa',          4,'até falha'),
  ex('3','Desenvolvimento',     3,'8 reps'),
  ex('4','Remada curvada',      3,'8 reps'),
  ex('5','Bíceps + Tríceps (bi-set)', 3,'12 reps'),
];
const FORCA_LOWER: Ex[] = [
  ex('1','Agachamento livre',   4,'6-8 reps'),
  ex('2','Levantamento terra',  3,'6 reps'),
  ex('3','Leg press',           3,'10 reps'),
  ex('4','Mesa flexora',        3,'12 reps'),
  ex('5','Panturrilha em pé',   4,'15 reps'),
];
const FORCA_UPPER2: Ex[] = [
  ex('1','Supino inclinado',    4,'6 reps'),
  ex('2','Puxada triângulo',    4,'8 reps'),
  ex('3','Desenvolvimento DB',  3,'8 reps'),
  ex('4','Remada unilateral',   3,'8 reps'),
  ex('5','Tríceps francês',     3,'10 reps'),
];
const FORCA_LOWER2: Ex[] = [
  ex('1','Terra romeno',        4,'6 reps'),
  ex('2','Agachamento sumô',    3,'8 reps'),
  ex('3','Afundo com barra',    3,'8 reps cada'),
  ex('4','Cadeira extensora',   3,'12 reps'),
  ex('5','Panturrilha sentado', 4,'15 reps'),
];
const FORCA_FULL: Ex[] = [
  ex('1','Supino reto',         3,'5 reps'),
  ex('2','Agachamento',         3,'5 reps'),
  ex('3','Terra convencional',  3,'5 reps'),
  ex('4','Desenvolvimento',     3,'8 reps'),
  ex('5','Barra fixa',          3,'até falha'),
];

// ── CONDICIONAMENTO — Rápido (30 min) ────────────────────────────────────────
const COND_A: Ex[] = [
  ex('1','Agachamento',         3,'10 reps'),
  ex('2','Supino',              3,'10 reps'),
  ex('3','Remada',              3,'10 reps'),
  ex('4','Elevação lateral',    3,'12 reps'),
  ex('5','Prancha',             3,'30 seg'),
];
const COND_B: Ex[] = [
  ex('1','Agachamento com salto',4,'20 reps'),
  ex('2','Flexão explosiva',     3,'12 reps'),
  ex('3','Swing kettlebell',     4,'20 reps'),
  ex('4','Box jump',             3,'15 reps'),
  ex('5','Corda battle',         4,'30 seg'),
];
const COND_C: Ex[] = [
  ex('1','Burpee',              4,'15 reps'),
  ex('2','Mountain climber',    3,'30 seg'),
  ex('3','Polichinelo',         3,'40 reps'),
  ex('4','Prancha dinâmica',    3,'45 seg'),
  ex('5','Abdominal',           3,'20 reps'),
];
const COND_D: Ex[] = [
  ex('1','Afundo com salto',    3,'12 reps cada'),
  ex('2','Flexão de braço',     3,'15 reps'),
  ex('3','Agachamento sumô',    3,'20 reps'),
  ex('4','Corda (pular)',        4,'1 min'),
  ex('5','Prancha',             3,'45 seg'),
];
const COND_E: Ex[] = [
  ex('1','Sprint (esteira)',     8,'30 seg forte/30 leve'),
  ex('2','Agachamento',         3,'15 reps'),
  ex('3','Remada curvada',      3,'12 reps'),
  ex('4','Supino inclinado',    3,'12 reps'),
  ex('5','Abdominal bicicleta', 3,'20 reps'),
];

// ─────────────────────────────────────────────────────────────────────────────
// PLANO BUILDER
// ─────────────────────────────────────────────────────────────────────────────

interface PlanDay {
  name: string;
  muscleGroup: string;
  exercises: Ex[];
  duration: number;
}

const PLANS: Record<Goal, Record<Level, PlanDay[]>> = {
  hipertrofia: {
    iniciante: [
      { name:'Full Body A', muscleGroup:'full',   exercises: INICIANTE_A, duration:45 },
      { name:'Full Body B', muscleGroup:'full',   exercises: INICIANTE_B, duration:45 },
      { name:'Full Body C', muscleGroup:'full',   exercises: INICIANTE_C, duration:45 },
      { name:'Full Body D', muscleGroup:'full',   exercises: INICIANTE_D, duration:45 },
      { name:'Full Body E', muscleGroup:'full',   exercises: INICIANTE_E, duration:45 },
    ],
    intermediario: [
      { name:'Push',        muscleGroup:'peito',  exercises: HIPER_PUSH,  duration:60 },
      { name:'Pull',        muscleGroup:'costas', exercises: HIPER_PULL,  duration:60 },
      { name:'Legs',        muscleGroup:'pernas', exercises: HIPER_LEGS,  duration:60 },
      { name:'Push B',      muscleGroup:'peito',  exercises: HIPER_PUSH2, duration:60 },
      { name:'Pull B',      muscleGroup:'costas', exercises: HIPER_PULL2, duration:60 },
    ],
    avancado: [
      { name:'Push',        muscleGroup:'peito',  exercises: HIPER_PUSH,  duration:75 },
      { name:'Pull',        muscleGroup:'costas', exercises: HIPER_PULL,  duration:75 },
      { name:'Legs',        muscleGroup:'pernas', exercises: HIPER_LEGS,  duration:75 },
      { name:'Push B',      muscleGroup:'peito',  exercises: HIPER_PUSH2, duration:75 },
      { name:'Pull B',      muscleGroup:'costas', exercises: HIPER_PULL2, duration:75 },
    ],
  },
  emagrecimento: {
    iniciante: [
      { name:'HIIT A',      muscleGroup:'full',   exercises: EMAG_HIIT_A, duration:35 },
      { name:'Musculação A',muscleGroup:'full',   exercises: EMAG_MUSC_A, duration:40 },
      { name:'HIIT B',      muscleGroup:'full',   exercises: EMAG_HIIT_B, duration:35 },
      { name:'Musculação B',muscleGroup:'full',   exercises: EMAG_MUSC_B, duration:40 },
      { name:'Cardio',      muscleGroup:'full',   exercises: EMAG_CARDIO, duration:40 },
    ],
    intermediario: [
      { name:'HIIT A',      muscleGroup:'full',   exercises: EMAG_HIIT_A, duration:40 },
      { name:'Musculação A',muscleGroup:'full',   exercises: EMAG_MUSC_A, duration:50 },
      { name:'HIIT B',      muscleGroup:'full',   exercises: EMAG_HIIT_B, duration:40 },
      { name:'Musculação B',muscleGroup:'full',   exercises: EMAG_MUSC_B, duration:50 },
      { name:'Cardio',      muscleGroup:'full',   exercises: EMAG_CARDIO, duration:45 },
    ],
    avancado: [
      { name:'HIIT Pesado A',muscleGroup:'full',  exercises: EMAG_HIIT_A, duration:50 },
      { name:'Musculação A', muscleGroup:'full',  exercises: EMAG_MUSC_A, duration:60 },
      { name:'HIIT Pesado B',muscleGroup:'full',  exercises: EMAG_HIIT_B, duration:50 },
      { name:'Musculação B', muscleGroup:'full',  exercises: EMAG_MUSC_B, duration:60 },
      { name:'Cardio HIIT',  muscleGroup:'full',  exercises: EMAG_CARDIO, duration:50 },
    ],
  },
  forca: {
    iniciante: [
      { name:'Upper A',     muscleGroup:'peito',  exercises: FORCA_UPPER,  duration:55 },
      { name:'Lower A',     muscleGroup:'pernas', exercises: FORCA_LOWER,  duration:55 },
      { name:'Full Body',   muscleGroup:'full',   exercises: FORCA_FULL,   duration:55 },
      { name:'Upper B',     muscleGroup:'peito',  exercises: FORCA_UPPER2, duration:55 },
      { name:'Lower B',     muscleGroup:'pernas', exercises: FORCA_LOWER2, duration:55 },
    ],
    intermediario: [
      { name:'Upper A',     muscleGroup:'peito',  exercises: FORCA_UPPER,  duration:70 },
      { name:'Lower A',     muscleGroup:'pernas', exercises: FORCA_LOWER,  duration:70 },
      { name:'Upper B',     muscleGroup:'peito',  exercises: FORCA_UPPER2, duration:70 },
      { name:'Lower B',     muscleGroup:'pernas', exercises: FORCA_LOWER2, duration:70 },
      { name:'Full Body',   muscleGroup:'full',   exercises: FORCA_FULL,   duration:70 },
    ],
    avancado: [
      { name:'Upper A',     muscleGroup:'peito',  exercises: FORCA_UPPER,  duration:80 },
      { name:'Lower A',     muscleGroup:'pernas', exercises: FORCA_LOWER,  duration:80 },
      { name:'Upper B',     muscleGroup:'peito',  exercises: FORCA_UPPER2, duration:80 },
      { name:'Lower B',     muscleGroup:'pernas', exercises: FORCA_LOWER2, duration:80 },
      { name:'Full Body',   muscleGroup:'full',   exercises: FORCA_FULL,   duration:80 },
    ],
  },
  condicionamento: {
    iniciante: [
      { name:'Treino A',    muscleGroup:'full',   exercises: COND_A, duration:30 },
      { name:'Treino B',    muscleGroup:'full',   exercises: COND_B, duration:30 },
      { name:'Treino C',    muscleGroup:'full',   exercises: COND_C, duration:30 },
      { name:'Treino D',    muscleGroup:'full',   exercises: COND_D, duration:30 },
      { name:'Treino E',    muscleGroup:'full',   exercises: COND_E, duration:30 },
    ],
    intermediario: [
      { name:'Treino A',    muscleGroup:'full',   exercises: COND_A, duration:40 },
      { name:'Treino B',    muscleGroup:'full',   exercises: COND_B, duration:40 },
      { name:'Treino C',    muscleGroup:'full',   exercises: COND_C, duration:40 },
      { name:'Treino D',    muscleGroup:'full',   exercises: COND_D, duration:40 },
      { name:'Treino E',    muscleGroup:'full',   exercises: COND_E, duration:40 },
    ],
    avancado: [
      { name:'Treino A',    muscleGroup:'full',   exercises: COND_A, duration:50 },
      { name:'Treino B',    muscleGroup:'full',   exercises: COND_B, duration:50 },
      { name:'Treino C',    muscleGroup:'full',   exercises: COND_C, duration:50 },
      { name:'Treino D',    muscleGroup:'full',   exercises: COND_D, duration:50 },
      { name:'Treino E',    muscleGroup:'full',   exercises: COND_E, duration:50 },
    ],
  },
};

// dayLabel → JS day index (0=Dom)
const DAY_SCHEDULE: Record<number, Array<{ label: string; index: number }>> = {
  3: [{ label:'Segunda', index:1 }, { label:'Quarta', index:3 }, { label:'Sexta',  index:5 }],
  4: [{ label:'Segunda', index:1 }, { label:'Terça',  index:2 }, { label:'Quinta', index:4 }, { label:'Sexta', index:5 }],
  5: [{ label:'Segunda', index:1 }, { label:'Terça',  index:2 }, { label:'Quarta', index:3 }, { label:'Quinta', index:4 }, { label:'Sexta', index:5 }],
};

function buildWorkouts(state: WizardState): GeneratedWorkout[] {
  const planDays = PLANS[state.goal!][state.level!].slice(0, state.days!);
  const levelLabel: 'Iniciante' | 'Intermediário' | 'Avançado' =
    state.level === 'avancado' ? 'Avançado'
    : state.level === 'intermediario' ? 'Intermediário'
    : 'Iniciante';
  const schedule = DAY_SCHEDULE[state.days!];

  return planDays.map((day, i) => ({
    id:                `${state.goal}-${state.level}-day${i + 1}`,
    name:              day.name,
    muscleGroup:       day.muscleGroup,
    exercises:         day.exercises.map((e, j) => ({ ...e, id: String(j + 1) })),
    estimatedDuration: day.duration,
    totalExercises:    day.exercises.length,
    difficulty:        levelLabel,
    dayLabel:          schedule[i]?.label ?? `Dia ${i + 1}`,
    dayIndex:          schedule[i]?.index ?? i,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// OPÇÕES DE UI
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { value: Goal; label: string; emoji: string; desc: string }[] = [
  { value:'hipertrofia',     label:'Hipertrofia',     emoji:'💪', desc:'Ganhar massa muscular' },
  { value:'emagrecimento',   label:'Emagrecimento',   emoji:'🔥', desc:'Queimar gordura' },
  { value:'forca',           label:'Força',           emoji:'🏋️', desc:'Aumentar a carga máxima' },
  { value:'condicionamento', label:'Condicionamento', emoji:'⚡', desc:'Melhorar o fôlego' },
];

const LEVEL_OPTIONS: { value: Level; label: string; desc: string }[] = [
  { value:'iniciante',     label:'Iniciante',     desc:'Menos de 6 meses de treino' },
  { value:'intermediario', label:'Intermediário', desc:'6 meses a 2 anos' },
  { value:'avancado',      label:'Avançado',      desc:'Mais de 2 anos' },
];

const DAYS_OPTIONS: { value: Days; label: string; desc: string }[] = [
  { value:3, label:'3 dias', desc:'Segunda, Quarta, Sexta' },
  { value:4, label:'4 dias', desc:'Seg, Ter, Qui, Sex' },
  { value:5, label:'5 dias', desc:'Segunda a Sexta' },
];

const MUSCLE_COLORS: Record<string, string> = {
  peito:'from-blue-500/20 to-blue-600/5',
  costas:'from-purple-500/20 to-purple-600/5',
  pernas:'from-orange-500/20 to-orange-600/5',
  ombros:'from-teal-500/20 to-teal-600/5',
  full:'from-primary/15 to-primary/5',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT: Record<number,string> = { 0:'Dom', 1:'Seg', 2:'Ter', 3:'Qua', 4:'Qui', 5:'Sex', 6:'Sáb' };

@Component({
  selector: 'app-my-workout',
  standalone: true,
  imports: [BottomNavComponent, NewPostModalComponent, FeedHeaderComponent, NotificationsPanelComponent],
  template: `
    @if (showNewPost()) {
      <app-new-post-modal (onClose)="showNewPost.set(false)" />
    }
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto">

      <app-feed-header
        [showBack]="true"
        (onBack)="back()"
        (onOpenNotifications)="showNotifications.set(true)" />

      <main class="flex-1 px-4 pb-28 overflow-y-auto" style="padding-top: calc(76px + env(safe-area-inset-top))">

        <section class="pt-5 pb-1">
          <p class="text-[22px] font-display font-bold text-white">Meu Treino</p>
          <p class="text-[12px] font-body text-text-2 mt-1">
            {{ step() !== 'result' && step() !== 'plan' ? 'Passo ' + (stepIndex() + 1) + ' de 3' : 'Monte, ajuste e acompanhe seu programa' }}
          </p>
        </section>

        @if (step() !== 'result' && step() !== 'plan') {
          <div class="flex gap-1.5 mb-5">
            @for (s of stepKeys; track s) {
              <div class="h-1.5 rounded-full transition-all duration-300"
                   [class]="s === step() ? 'w-6 bg-primary' : stepDone(s) ? 'w-2 bg-primary/50' : 'w-2 bg-border'"></div>
            }
          </div>
        }

        <!-- ── PLANO EXISTENTE ── -->
        @if (step() === 'plan') {
          <div class="animate-slide-up">

            <!-- Today highlight -->
            @if (todayWorkout()) {
              <div class="mb-6 rounded-2xl overflow-hidden border relative bg-gradient-to-br"
                   [class]="muscleGradient(todayWorkout()!.muscleGroup) + ' border-primary/40'">
                <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"></div>
                <div class="p-4">
                  <div class="flex items-center gap-2 mb-3">
                    @if (workoutService.isFinishedToday(todayWorkout()!.id)) {
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-widest">Concluído hoje</span>
                    } @else {
                      <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                      <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-widest">Treino de hoje · {{ todayWorkout()!.dayLabel }}</span>
                    }
                  </div>
                  <h3 class="text-[22px] font-display font-bold text-white mb-1">{{ todayWorkout()!.name }}</h3>
                  <div class="flex items-center gap-3 mb-4 text-[11px] font-body text-text-2">
                    <span>⏱ {{ todayWorkout()!.estimatedDuration }} min</span>
                    <span class="w-px h-3 bg-border"></span>
                    <span>{{ todayWorkout()!.totalExercises }} exercícios</span>
                  </div>
                  @if (!workoutService.isFinishedToday(todayWorkout()!.id)) {
                    <div class="flex gap-2">
                      <button (click)="previewWorkout.set(todayWorkout()!)"
                              class="flex-none px-4 py-3 rounded-xl bg-card border border-border text-text-2 hover:text-white font-body font-semibold text-[13px] transition-all active:scale-[0.98]">
                        Ver
                      </button>
                      <button (click)="startPlan(todayWorkout()!)"
                              class="flex-1 py-3 rounded-xl bg-primary text-bg font-display font-bold text-[15px] shadow-glow hover:shadow-glow-lg active:scale-[0.98] transition-all">
                        Iniciar treino de hoje
                      </button>
                    </div>
                  } @else {
                    <div class="w-full py-3 rounded-xl bg-primary/10 border border-primary/30 text-center text-primary font-body font-semibold text-[14px]">
                      Treino concluído ✓
                    </div>
                  }
                </div>

                        @if (showNotifications()) {
                          <app-notifications-panel (onClose)="showNotifications.set(false)" />
                        }
              </div>
            } @else {
              <div class="mb-6 bg-card-2 border border-border rounded-2xl p-4 text-center">
                <p class="text-[13px] font-body text-text-2">Hoje é dia de descanso 💤</p>
                <p class="text-[11px] font-body text-text-2/60 mt-1">Próximo treino: {{ nextWorkoutLabel() }}</p>
              </div>
            }

            <!-- Full week schedule -->
            <h3 class="text-[13px] font-body font-semibold text-text-2 uppercase tracking-widest mb-3">Plano da semana</h3>
            <div class="space-y-3">
              @for (w of workoutService.program()!.plans; track w.id; let i = $index) {
                <div class="rounded-2xl border overflow-hidden relative bg-gradient-to-br"
                     [class]="isToday(w.dayIndex)
                       ? muscleGradient(w.muscleGroup) + ' border-primary/40'
                       : muscleGradient(w.muscleGroup) + ' border-border'">
                  <div class="p-4">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
                                [class]="isToday(w.dayIndex) ? 'bg-primary text-bg border-primary' : 'text-text-2 border-border'">
                            {{ w.dayLabel }}
                          </span>
                          @if (workoutService.isFinishedToday(w.id) && isToday(w.dayIndex)) {
                            <span class="text-[10px] font-body text-primary">✓ Feito</span>
                          }
                        </div>
                        <h4 class="text-[16px] font-display font-bold text-white">{{ w.name }}</h4>
                        <p class="text-[11px] font-body text-text-2 mt-0.5">{{ w.totalExercises }} exercícios · {{ w.estimatedDuration }} min</p>
                      </div>
                      <div class="shrink-0 flex gap-1.5">
                        <button (click)="previewWorkout.set(w)"
                                class="flex items-center gap-1 px-3 py-2 rounded-xl border border-border bg-card text-text-2 hover:text-white text-[12px] font-body font-semibold transition-all active:scale-95">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          Ver
                        </button>
                        <button (click)="startPlan(w)"
                                class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-body font-semibold transition-all active:scale-95"
                                [class]="isToday(w.dayIndex) && !workoutService.isFinishedToday(w.id)
                                  ? 'bg-primary text-bg border-primary shadow-glow-sm'
                                  : 'bg-card border-border text-text-2 hover:text-white'">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                          Iniciar
                        </button>
                      </div>
                    </div>
                    <!-- Exercises preview -->
                    <div class="mt-3 space-y-1">
                      @for (ex of w.exercises.slice(0, 3); track ex.id) {
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <div class="w-1 h-1 rounded-full bg-primary/40 shrink-0"></div>
                            <span class="text-[11px] font-body text-text-2">{{ ex.name }}</span>
                          </div>
                          <span class="text-[10px] font-mono text-text-2/60">{{ ex.sets }}× {{ ex.reps }}</span>
                        </div>
                      }
                      @if (w.exercises.length > 3) {
                        <p class="text-[11px] font-body text-text-2/40 pl-3">+{{ w.exercises.length - 3 }} exercícios</p>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>

            <button (click)="confirmReset()"
                    class="mt-6 w-full py-3 rounded-2xl border border-border text-[13px] font-body font-medium text-text-2 hover:text-danger hover:border-danger/30 transition-colors">
              Criar novo plano
            </button>
          </div>
        }

        <!-- ── GOAL ── -->
        @if (step() === 'goal') {
          <div class="animate-slide-up">
            <header class="flex items-center gap-3 mb-6">
              <button (click)="back()" class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h2 class="text-[20px] font-display font-bold text-white">Objetivo</h2>
            </header>
            <p class="text-[13px] font-body text-text-2 mb-7">Vamos montar um plano completo pra você.</p>
            <div class="grid grid-cols-2 gap-3">
              @for (opt of goalOptions; track opt.value) {
                <button (click)="set('goal', opt.value)"
                        class="relative flex flex-col items-start gap-2 p-4 rounded-2xl border transition-all text-left"
                        [class]="wizard().goal === opt.value
                          ? 'bg-primary/10 border-primary shadow-glow-sm'
                          : 'bg-card-2 border-border hover:border-border-2'">
                  @if (wizard().goal === opt.value) {
                    <div class="absolute top-3 right-3 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  }
                  <span class="text-[28px]">{{ opt.emoji }}</span>
                  <div>
                    <p class="text-[14px] font-body font-semibold text-white">{{ opt.label }}</p>
                    <p class="text-[11px] font-body text-text-2 mt-0.5">{{ opt.desc }}</p>
                  </div>
                </button>
              }
            </div>
          </div>
        }

        <!-- ── LEVEL ── -->
        @if (step() === 'level') {
          <div class="animate-slide-up">
            <header class="flex items-center gap-3 mb-6">
              <button (click)="back()" class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h2 class="text-[20px] font-display font-bold text-white">Nível</h2>
            </header>
            <p class="text-[13px] font-body text-text-2 mb-7">Isso define intensidade e volume do treino.</p>
            <div class="space-y-3">
              @for (opt of levelOptions; track opt.value) {
                <button (click)="set('level', opt.value)"
                        class="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left"
                        [class]="wizard().level === opt.value
                          ? 'bg-primary/10 border-primary shadow-glow-sm'
                          : 'bg-card-2 border-border hover:border-border-2'">
                  <div class="w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-colors"
                       [class]="wizard().level === opt.value ? 'bg-primary border-primary' : 'bg-card border-border'">
                    @if (wizard().level === opt.value) {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    }
                  </div>
                  <div>
                    <p class="text-[15px] font-body font-semibold text-white">{{ opt.label }}</p>
                    <p class="text-[12px] font-body text-text-2 mt-0.5">{{ opt.desc }}</p>
                  </div>
                </button>
              }
            </div>
          </div>
        }

        <!-- ── DAYS ── -->
        @if (step() === 'days') {
          <div class="animate-slide-up">
            <header class="flex items-center gap-3 mb-6">
              <button (click)="back()" class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h2 class="text-[20px] font-display font-bold text-white">Dias por semana</h2>
            </header>
            <p class="text-[13px] font-body text-text-2 mb-7">Cada dia terá um treino completo e diferente.</p>
            <div class="space-y-3">
              @for (opt of daysOptions; track opt.value) {
                <button (click)="set('days', opt.value)"
                        class="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all text-left"
                        [class]="wizard().days === opt.value
                          ? 'bg-primary/10 border-primary shadow-glow-sm'
                          : 'bg-card-2 border-border hover:border-border-2'">
                  <div>
                    <p class="text-[18px] font-display font-bold text-white">{{ opt.label }}</p>
                    <p class="text-[12px] font-body text-text-2 mt-0.5">{{ opt.desc }}</p>
                  </div>
                  <div class="flex gap-1 shrink-0">
                    @for (d of dayDots(opt.value); track d) {
                      <div class="w-2 h-2 rounded-full transition-colors"
                           [class]="wizard().days === opt.value ? 'bg-primary' : 'bg-border'"></div>
                    }
                  </div>
                </button>
              }
            </div>
          </div>
        }

        <!-- ── RESULT ── -->
        @if (step() === 'result') {
          <div class="animate-slide-up">
            <header class="flex items-center gap-3 mb-6">
              <button (click)="back()" class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h2 class="text-[20px] font-display font-bold text-white">Plano gerado</h2>
            </header>
            <p class="text-[13px] font-body text-text-2 mb-6">
              {{ generated().length }} treinos · {{ wizard().days }}x/semana · {{ goalLabel() }} · {{ levelLabel() }}
            </p>
            <div class="space-y-4">
              @for (w of generated(); track w.id; let i = $index) {
                <div class="rounded-2xl border overflow-hidden relative bg-gradient-to-br"
                     [class]="muscleGradient(w.muscleGroup) + ' border-border'">

                  <!-- Day pill -->
                  <div class="absolute top-4 right-4 bg-bg/60 border border-border rounded-full px-2.5 py-1">
                    <span class="text-[10px] font-mono font-bold text-primary">{{ w.dayLabel }}</span>
                  </div>

                  <div class="p-4">
                    <p class="text-[10px] font-body text-text-2 uppercase tracking-widest mb-0.5">Treino {{ i + 1 }}</p>
                    <h3 class="text-[19px] font-display font-bold text-white mb-1 pr-20">{{ w.name }}</h3>

                    <div class="flex items-center gap-3 mb-4">
                      <span class="text-[11px] font-body text-text-2">⏱ {{ w.estimatedDuration }} min</span>
                      <span class="w-px h-3 bg-border"></span>
                      <span class="text-[11px] font-body text-text-2">{{ w.totalExercises }} exercícios</span>
                      <span class="w-px h-3 bg-border"></span>
                      <span class="text-[11px] font-body" [class]="diffClass(w.difficulty)">{{ w.difficulty }}</span>
                    </div>

                    <!-- Exercise list -->
                    <div class="space-y-2 mb-4">
                      @for (ex of w.exercises; track ex.id) {
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <div class="w-1 h-1 rounded-full bg-primary/50 shrink-0"></div>
                            <span class="text-[12px] font-body text-white">{{ ex.name }}</span>
                          </div>
                          <span class="text-[11px] font-mono text-primary shrink-0 ml-2">{{ ex.sets }}× {{ ex.reps }}</span>
                        </div>
                      }
                    </div>

                    <div class="flex gap-2">
                      <button (click)="previewWorkout.set(w)"
                              class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card text-text-2 hover:text-white text-[13px] font-body font-semibold transition-all active:scale-95">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        Ver
                      </button>
                      <button (click)="startWorkout(w)"
                              class="flex-1 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary font-body font-semibold text-[13px] hover:bg-primary/25 active:scale-[0.98] transition-all">
                        Iniciar treino
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>

            <button (click)="reset()"
                    class="mt-5 w-full py-3 rounded-2xl border border-border text-[13px] font-body font-medium text-text-2 hover:text-white hover:border-border-2 transition-colors">
              Refazer questionário
            </button>
          </div>
        }

      </main>

      <!-- Bottom CTA -->
      @if (step() !== 'result' && step() !== 'plan') {
        <div class="sticky bottom-0 px-4 pb-8 pt-4 glass border-t border-border">
          <button (click)="next()"
                  [disabled]="!canAdvance()"
                  class="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90%] py-4 rounded-2xl font-display font-bold text-[16px] transition-all bg-card-2 border border-border text-text-2"
                  [class]="canAdvance()
                    ? 'bg-primary text-bg shadow-glow hover:shadow-glow-lg active:scale-[0.98]'
                    : 'bg-card-2 text-text-2 border border-border cursor-not-allowed'">
            {{ step() === 'days' ? 'Gerar plano' : 'Continuar' }}
          </button>
        </div>
      }



      <app-bottom-nav [active]="'my-workout'" (onNewPost)="showNewPost.set(true)" />

      <!-- Preview sheet -->
      @if (previewWorkout()) {
        <div class="fixed inset-0 z-50 flex flex-col justify-end max-w-[430px] mx-auto">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="previewWorkout.set(null)"></div>
          <div class="relative bg-card border-t border-border rounded-t-2xl flex flex-col animate-slide-up"
               style="max-height: 85dvh">
            <!-- Handle + header -->
            <div class="flex flex-col items-center pt-3 pb-0 shrink-0">
              <div class="w-10 h-1 bg-border-2 rounded-full mb-3"></div>
              <div class="w-full flex items-center justify-between px-5 pb-3 border-b border-border">
                <div>
                  <p class="text-[15px] font-display font-bold text-white">{{ previewWorkout()!.name }}</p>
                  <p class="text-[11px] text-text-2 font-body mt-0.5">
                    {{ previewWorkout()!.totalExercises }} exercícios · {{ previewWorkout()!.estimatedDuration }} min · {{ previewWorkout()!.difficulty }}
                  </p>
                </div>
                <button (click)="previewWorkout.set(null)" class="text-text-2 hover:text-white transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <!-- Exercise list -->
            <div class="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              @for (ex of previewWorkout()!.exercises; track ex.id; let i = $index) {
                <div class="flex items-center gap-3 bg-card-2 border border-border rounded-xl px-4 py-3">
                  <span class="text-[11px] font-mono text-text-2 w-5 shrink-0">{{ i + 1 }}</span>
                  <span class="flex-1 text-[14px] font-body text-white">{{ ex.name }}</span>
                  <span class="text-[12px] font-mono text-primary shrink-0">{{ ex.sets }}× {{ ex.reps }}</span>
                </div>
              }
            </div>
            <!-- CTA -->
            <div class="shrink-0 px-4 py-4 border-t border-border"
                 style="padding-bottom: calc(16px + env(safe-area-inset-bottom))">
              <button (click)="startPlan(previewWorkout()!); previewWorkout.set(null)"
                      class="w-full py-3.5 rounded-xl bg-primary text-bg font-display font-bold text-[15px] shadow-glow hover:shadow-glow-lg active:scale-[0.98] transition-all">
                Iniciar treino
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class MyWorkoutComponent implements OnInit {
  private router   = inject(Router);
  private location = inject(Location);
  workoutService   = inject(WorkoutService);

  readonly stepKeys: Step[] = ['goal', 'level', 'days'];
  showNotifications = signal(false);
  readonly goalOptions  = GOAL_OPTIONS;
  readonly levelOptions = LEVEL_OPTIONS;
  readonly daysOptions  = DAYS_OPTIONS;

  step           = signal<Step>('goal');
  wizard         = signal<WizardState>({ goal: null, level: null, days: null });
  generated      = signal<GeneratedWorkout[]>([]);
  previewWorkout = signal<StoredPlan | GeneratedWorkout | null>(null);
  showNewPost = signal(false);

  stepIndex = computed(() => this.stepKeys.indexOf(this.step() as any));

  todayWorkout = computed(() => this.workoutService.todayWorkout());

  nextWorkoutLabel = computed(() => {
    const prog = this.workoutService.program();
    if (!prog) return '';
    const today = new Date().getDay();
    const next = prog.plans
      .map(p => ({ ...p, diff: (p.dayIndex - today + 7) % 7 || 7 }))
      .sort((a, b) => a.diff - b.diff)[0];
    return next ? `${next.dayLabel} — ${next.name}` : '';
  });

  canAdvance = computed(() => {
    const w = this.wizard();
    switch (this.step()) {
      case 'goal':  return !!w.goal;
      case 'level': return !!w.level;
      case 'days':  return !!w.days;
      default: return false;
    }
  });

  levelLabel = computed(() => {
    const map: Record<string, string> = { iniciante:'Iniciante', intermediario:'Intermediário', avancado:'Avançado' };
    return map[this.wizard().level ?? ''] ?? '';
  });

  goalLabel = computed(() => {
    const map: Record<string, string> = { hipertrofia:'Hipertrofia', emagrecimento:'Emagrecimento', forca:'Força', condicionamento:'Condicionamento' };
    return map[this.wizard().goal ?? ''] ?? '';
  });

  ngOnInit(): void {
    // Se já tem plano salvo, vai direto para a view do plano
    if (this.workoutService.hasProgram()) {
      this.step.set('plan');
    }
  }

  isToday(dayIndex: number): boolean {
    return new Date().getDay() === dayIndex;
  }

  stepDone(s: Step): boolean {
    const order: Step[] = ['goal', 'level', 'days'];
    return order.indexOf(s) < this.stepIndex();
  }

  dayDots(n: number): number[] {
    return Array.from({ length: n });
  }

  muscleGradient(mg: string): string {
    return MUSCLE_COLORS[mg] ?? MUSCLE_COLORS['full'];
  }

  diffClass(d: string): string {
    if (d === 'Avançado')      return 'text-danger';
    if (d === 'Intermediário') return 'text-secondary';
    return 'text-primary';
  }

  set(field: keyof WizardState, value: any): void {
    this.wizard.update(w => ({ ...w, [field]: value }));
  }

  next(): void {
    const order: Step[] = ['goal', 'level', 'days'];
    const idx = order.indexOf(this.step() as any);
    if (idx < order.length - 1) {
      this.step.set(order[idx + 1]);
    } else {
      const workouts = buildWorkouts(this.wizard());
      const program: ActiveProgram = {
        goal:      this.wizard().goal!,
        level:     this.wizard().level!,
        days:      this.wizard().days!,
        plans:     workouts,
        createdAt: new Date().toISOString(),
      };
      this.workoutService.saveProgram(program);
      this.generated.set(workouts);
      this.step.set('result');
    }
  }

  back(): void {
    if (this.step() === 'plan') { this.location.back(); return; }
    const order: Step[] = ['goal', 'level', 'days'];
    const idx = order.indexOf(this.step() as any);
    if (idx > 0) {
      this.step.set(order[idx - 1]);
    } else {
      // se tem plano, volta para view do plano; senão sai
      this.workoutService.hasProgram() ? this.step.set('plan') : this.location.back();
    }
  }

  startPlan(w: StoredPlan | GeneratedWorkout): void {
    this.router.navigateByUrl(`/workout/${w.id}`);
  }

  startWorkout(w: GeneratedWorkout): void {
    this.router.navigateByUrl(`/workout/${w.id}`);
  }

  confirmReset(): void {
    if (confirm('Apagar plano atual e criar um novo?')) {
      this.workoutService.clearProgram();
      this.wizard.set({ goal: null, level: null, days: null });
      this.generated.set([]);
      this.step.set('goal');
    }
  }

  reset(): void {
    this.workoutService.clearProgram();
    this.wizard.set({ goal: null, level: null, days: null });
    this.generated.set([]);
    this.step.set('goal');
  }
}
