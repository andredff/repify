import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { WorkoutAccessState, WorkoutService, ActiveProgram, StoredPlan, DAY_INDEX_MAP, WorkoutSession } from '../../core/services/workout.service';
import { PostService } from '../../core/services/post.service';
import { WorkoutPost } from '../../core/models/workout-post.model';
import { BottomNavComponent } from '../feed/components/bottom-nav.component';
import { NewPostModalComponent, WorkoutPostPrefillSummary } from '../feed/components/new-post-modal.component';
import { FeedHeaderComponent } from '../feed/components/feed-header.component';
import { NotificationsPanelComponent } from '../feed/components/notifications-panel.component';

type Step = 'plan' | 'goal' | 'level' | 'duration' | 'result';
type Goal = 'hipertrofia' | 'emagrecimento' | 'forca' | 'condicionamento';
type Level = 'iniciante' | 'intermediario' | 'avancado';
type Days = 5;
type SessionDuration = 20 | 40 | 60;

interface WizardState {
  goals:           Goal[];
  level:           Level           | null;
  sessionDuration: SessionDuration | null;
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

// ── TREINO EM CASA — Bodyweight ───────────────────────────────────────────────
const HOME_A: Ex[] = [
  ex('1','Agachamento',           3,'15 reps'),
  ex('2','Flexão de braço',       3,'12 reps'),
  ex('3','Afundo',                3,'10 reps cada'),
  ex('4','Tríceps no chão',       3,'12 reps'),
  ex('5','Abdominal crunch',      3,'20 reps'),
];
const HOME_B: Ex[] = [
  ex('1','Agachamento sumô',      3,'15 reps'),
  ex('2','Flexão diamante',       3,'10 reps'),
  ex('3','Glúteo 4 apoios',       3,'15 reps cada'),
  ex('4','Flexão fechada',        3,'10 reps'),
  ex('5','Prancha',               3,'45 seg'),
];
const HOME_C: Ex[] = [
  ex('1','Agachamento com pulso', 3,'12 reps'),
  ex('2','Burpee',                3,'10 reps'),
  ex('3','Flexão Pike',           3,'10 reps'),
  ex('4','Mountain climber',      3,'30 seg'),
  ex('5','Abdominal bicicleta',   3,'20 reps'),
];
const HOME_D: Ex[] = [
  ex('1','Agachamento isométrico',3,'40 seg'),
  ex('2','Flexão explosiva',      3,'10 reps'),
  ex('3','Passada lateral',       3,'12 reps cada'),
  ex('4','Tríceps no banco',      3,'12 reps'),
  ex('5','Elevação de quadril',   3,'20 reps'),
];
const HOME_E: Ex[] = [
  ex('1','Jump squat',            3,'15 reps'),
  ex('2','Flexão arqueiro',       3,'6 reps cada'),
  ex('3','Afundo com salto',      3,'10 reps cada'),
  ex('4','Prancha lateral',       3,'30 seg cada'),
  ex('5','Abdominal V',           3,'15 reps'),
];

// ── CALISTENIA ────────────────────────────────────────────────────────────────
const CALI_A: Ex[] = [
  ex('1','Barra fixa pronada',    3,'até falha'),
  ex('2','Flexão de braço',       3,'15 reps'),
  ex('3','Dip em banco',          3,'12 reps'),
  ex('4','Agachamento',           3,'20 reps'),
  ex('5','Prancha',               3,'1 min'),
];
const CALI_B: Ex[] = [
  ex('1','Barra supinada',        3,'até falha'),
  ex('2','Flexão diamante',       3,'12 reps'),
  ex('3','Agachamento pistol',    3,'4 reps cada'),
  ex('4','L-sit (cadeira)',        3,'10 seg'),
  ex('5','Abdominal',             3,'20 reps'),
];
const CALI_C: Ex[] = [
  ex('1','Barra australiana',     3,'12 reps'),
  ex('2','Flexão Pike',           3,'10 reps'),
  ex('3','Afundo',                3,'12 reps cada'),
  ex('4','Dip paralelo',          3,'até falha'),
  ex('5','Prancha lateral',       3,'30 seg cada'),
];
const CALI_D: Ex[] = [
  ex('1','Barra fixa negativa',   3,'5 reps'),
  ex('2','Barra fixa pronada',    3,'até falha'),
  ex('3','Flexão arqueiro',       3,'5 reps cada'),
  ex('4','Agachamento c/ salto',  3,'15 reps'),
  ex('5','Knee raise na barra',   3,'12 reps'),
];
const CALI_E: Ex[] = [
  ex('1','Front lever hold',      3,'5 seg'),
  ex('2','Barra supinada',        3,'até falha'),
  ex('3','Dip ponderado',         3,'8 reps'),
  ex('4','Pistol squat',          3,'5 reps cada'),
  ex('5','Prancha',               3,'90 seg'),
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

const HOME_PLANS: Record<Level, PlanDay[]> = {
  iniciante: [
    { name:'Casa A', muscleGroup:'full', exercises: HOME_A, duration:25 },
    { name:'Casa B', muscleGroup:'full', exercises: HOME_B, duration:25 },
    { name:'Casa C', muscleGroup:'full', exercises: HOME_C, duration:30 },
    { name:'Casa D', muscleGroup:'full', exercises: HOME_D, duration:30 },
    { name:'Casa E', muscleGroup:'full', exercises: HOME_E, duration:30 },
  ],
  intermediario: [
    { name:'Casa A', muscleGroup:'full', exercises: HOME_A, duration:35 },
    { name:'Casa B', muscleGroup:'full', exercises: HOME_B, duration:35 },
    { name:'Casa C', muscleGroup:'full', exercises: HOME_C, duration:35 },
    { name:'Casa D', muscleGroup:'full', exercises: HOME_D, duration:35 },
    { name:'Casa E', muscleGroup:'full', exercises: HOME_E, duration:35 },
  ],
  avancado: [
    { name:'Casa A', muscleGroup:'full', exercises: HOME_A, duration:45 },
    { name:'Casa B', muscleGroup:'full', exercises: HOME_B, duration:45 },
    { name:'Casa C', muscleGroup:'full', exercises: HOME_C, duration:45 },
    { name:'Casa D', muscleGroup:'full', exercises: HOME_D, duration:45 },
    { name:'Casa E', muscleGroup:'full', exercises: HOME_E, duration:45 },
  ],
};

const CALI_PLANS: Record<Level, PlanDay[]> = {
  iniciante: [
    { name:'Cali A', muscleGroup:'full', exercises: CALI_A, duration:35 },
    { name:'Cali B', muscleGroup:'full', exercises: CALI_B, duration:35 },
    { name:'Cali C', muscleGroup:'full', exercises: CALI_C, duration:35 },
    { name:'Cali D', muscleGroup:'full', exercises: CALI_D, duration:35 },
    { name:'Cali E', muscleGroup:'full', exercises: CALI_E, duration:35 },
  ],
  intermediario: [
    { name:'Cali A', muscleGroup:'full', exercises: CALI_A, duration:45 },
    { name:'Cali B', muscleGroup:'full', exercises: CALI_B, duration:45 },
    { name:'Cali C', muscleGroup:'full', exercises: CALI_C, duration:45 },
    { name:'Cali D', muscleGroup:'full', exercises: CALI_D, duration:45 },
    { name:'Cali E', muscleGroup:'full', exercises: CALI_E, duration:45 },
  ],
  avancado: [
    { name:'Cali A', muscleGroup:'full', exercises: CALI_A, duration:55 },
    { name:'Cali B', muscleGroup:'full', exercises: CALI_B, duration:55 },
    { name:'Cali C', muscleGroup:'full', exercises: CALI_C, duration:55 },
    { name:'Cali D', muscleGroup:'full', exercises: CALI_D, duration:55 },
    { name:'Cali E', muscleGroup:'full', exercises: CALI_E, duration:55 },
  ],
};

// dayLabel → JS day index (0=Dom)
const DAY_SCHEDULE: Array<{ label: string; index: number }> = [
  { label:'Segunda', index:1 },
  { label:'Terça', index:2 },
  { label:'Quarta', index:3 },
  { label:'Quinta', index:4 },
  { label:'Sexta', index:5 },
];

const FIXED_TRAINING_DAYS: Days = 5;

function buildWorkouts(state: WizardState): GeneratedWorkout[] {
  const selectedGoals: Goal[] = state.goals.length ? state.goals : ['hipertrofia'];
  const rawDays = DAY_SCHEDULE.map((_, index) => {
    const goal = selectedGoals[index % selectedGoals.length];
    const planDays = PLANS[goal][state.level!];
    const day = planDays[index % planDays.length];
    return { ...day, goal };
  });

  const levelLabel: 'Iniciante' | 'Intermediário' | 'Avançado' =
    state.level === 'avancado' ? 'Avançado'
    : state.level === 'intermediario' ? 'Intermediário'
    : 'Iniciante';
  const schedule = DAY_SCHEDULE;

  return rawDays.map((day, i) => {
    let exercises: Ex[] = day.exercises;
    let duration  = day.duration;

    if (state.sessionDuration === 20) {
      exercises = exercises.slice(0, 3).map(e => ({ ...e, sets: Math.max(2, e.sets - 1) }));
      duration  = 20;
    } else if (state.sessionDuration === 60) {
      exercises = exercises.map(e => ({ ...e, sets: Math.min(5, e.sets + 1) }));
      duration  = day.duration + 15;
    }

    const goalLabel = GOAL_OPTIONS.find(option => option.value === day.goal)?.label ?? 'Treino personalizado';

    return {
      id:                `${selectedGoals.join('-')}-${state.level}-day${i + 1}`,
      name:              selectedGoals.length > 1 ? `${goalLabel} • ${day.name}` : day.name,
      muscleGroup:       day.muscleGroup,
      exercises:         exercises.map((exercise, index) => ({ ...exercise, id: String(index + 1) })),
      estimatedDuration: duration,
      totalExercises:    exercises.length,
      difficulty:        levelLabel,
      dayLabel:          schedule[i]?.label ?? `Dia ${i + 1}`,
      dayIndex:          schedule[i]?.index ?? i,
    };
  });
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

const DURATION_OPTIONS: { value: SessionDuration; label: string; desc: string }[] = [
  { value:20, label:'20 min', desc:'Curto e intenso — foco máximo, 3 exercícios' },
  { value:40, label:'40 min', desc:'Equilíbrio ideal — volume e qualidade' },
  { value:60, label:'60+ min', desc:'Volume alto — mais séries, mais resultado' },
];

const WEEK_PROGRESSION = [
  { week:1, tag:'Adaptação',    desc:'Foco em técnica, 70% do esforço',         bar:25 },
  { week:2, tag:'Volume',       desc:'Séries completas, ritmo constante',       bar:50 },
  { week:3, tag:'Intensidade',  desc:'Aumente a carga ou reduza o descanso',    bar:75 },
  { week:4, tag:'Consolidação', desc:'Máxima intensidade do ciclo',             bar:100 },
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
      <app-new-post-modal
        [title]="newPostTitle()"
        [prefillCaption]="newPostCaption()"
        [prefillWorkout]="newPostWorkout()"
        [prefillSummary]="newPostSummary()"
        (onClose)="showNewPost.set(false)"
        (onPublish)="onWorkoutPostPublished($event)" />
    }
    <div class="min-h-screen bg-bg flex flex-col max-w-[430px] mx-auto lg:max-w-3xl">

      @if (!showNewPost()) {
        <app-feed-header
          [showBack]="true"
          (onBack)="back()"
          (onOpenNotifications)="showNotifications.set(true)" />
      }

      <main class="flex-1 px-4 pb-28 lg:pb-12 overflow-y-auto lg:pt-8" style="padding-top: calc(76px + env(safe-area-inset-top))">

        <section class="pt-0 pb-5">
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
                    @if (todayWorkoutAccess().state === 'completed') {
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-widest">Concluído hoje</span>
                    } @else if (todayWorkoutAccess().state === 'in_progress') {
                      <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                      <span class="text-[10px] font-body font-semibold text-primary uppercase tracking-widest">Treino em andamento · {{ todayWorkout()!.dayLabel }}</span>
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
                  @if (todayWorkoutAccess().state !== 'completed') {
                    <div class="flex gap-2">
                      <button (click)="previewWorkout.set(todayWorkout()!)"
                              class="flex-none px-4 py-3 rounded-xl bg-card border border-border text-text-2 hover:text-white font-body font-semibold text-[13px] transition-all active:scale-[0.98]">
                        Ver
                      </button>
                      <button type="button"
                              (click)="startPlan(todayWorkout()!)"
                              [disabled]="!todayWorkoutAccess().canStart"
                              class="flex-1 py-3 rounded-xl font-display font-bold text-[15px] transition-all"
                              [class]="todayWorkoutAccess().canStart
                                ? 'bg-primary text-bg shadow-glow hover:shadow-glow-lg active:scale-[0.98]'
                                : 'bg-card border border-border text-text-2 cursor-not-allowed'">
                        {{ todayWorkoutAccess().state === 'in_progress' ? 'Continuar treino' : 'Iniciar treino de hoje' }}
                      </button>
                    </div>
                  } @else {
                    <div class="space-y-2">
                      <div class="w-full py-3 rounded-xl bg-primary/10 border border-primary/30 text-center text-primary font-body font-semibold text-[14px]">
                        Treino concluído ✓
                      </div>
                      <button type="button"
                              (click)="openCompletedWorkoutPostComposer()"
                              class="w-full py-3 rounded-xl bg-primary text-bg font-display font-bold text-[14px] shadow-glow transition-all hover:shadow-glow-lg active:scale-[0.98]">
                        Criar postagem do treino
                      </button>
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
                          @if (workoutAccess(w).state === 'completed' && isToday(w.dayIndex)) {
                            <span class="text-[10px] font-body text-primary">✓ Feito</span>
                          } @else if (workoutAccess(w).state === 'in_progress' && isToday(w.dayIndex)) {
                            <span class="text-[10px] font-body text-primary">Em andamento</span>
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
                                type="button"
                                [disabled]="!workoutAccess(w).canStart"
                                class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-body font-semibold transition-all active:scale-95"
                                [class]="workoutAccess(w).canStart
                                  ? 'bg-primary text-bg border-primary shadow-glow-sm'
                                  : workoutAccess(w).state === 'completed'
                                    ? 'bg-primary/10 border-primary/30 text-primary cursor-not-allowed'
                                    : 'bg-card border-border text-text-2 cursor-not-allowed'">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                          {{ workoutAccess(w).label }}
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
            <p class="text-[13px] font-body text-text-2 mb-3">Escolha um ou mais objetivos para misturar o foco da sua semana.</p>
            <div class="mb-7 rounded-2xl border border-primary/15 bg-primary/8 px-4 py-3 text-[11px] font-body leading-relaxed text-text-2">
              O plano sempre será montado de segunda a sexta. Quando você marcar mais de um objetivo, o Repify alterna sessões específicas ao longo da semana.
            </div>
            <div class="grid grid-cols-2 gap-3">
              @for (opt of goalOptions; track opt.value) {
                <button (click)="toggleGoal(opt.value)"
                        class="relative flex flex-col items-start gap-2 p-4 rounded-2xl border transition-all text-left"
                        [attr.aria-pressed]="hasGoal(opt.value)"
                        [class]="hasGoal(opt.value)
                          ? 'bg-primary/10 border-primary shadow-glow-sm'
                          : 'bg-card-2 border-border hover:border-border-2'">
                  @if (hasGoal(opt.value)) {
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

        <!-- ── DURATION ── -->
        @if (step() === 'duration') {
          <div class="animate-slide-up">
            <header class="flex items-center gap-3 mb-6">
              <button (click)="back()" class="w-9 h-9 flex items-center justify-center rounded-full bg-card-2 border border-border text-text-2 hover:text-white transition-colors shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h2 class="text-[20px] font-display font-bold text-white">Quanto tempo você tem?</h2>
            </header>
            <p class="text-[13px] font-body text-text-2 mb-7">Isso define o volume e número de exercícios por sessão.</p>
            <div class="space-y-3">
              @for (opt of durationOptions; track opt.value) {
                <button (click)="set('sessionDuration', opt.value)"
                        class="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all text-left active:scale-[0.97]"
                        [class]="wizard().sessionDuration === opt.value
                          ? 'bg-primary/10 border-primary shadow-glow-sm'
                          : 'bg-card-2 border-border hover:border-border-2'">
                  <div class="flex-1">
                    <p class="text-[20px] font-display font-bold text-white">{{ opt.label }}</p>
                    <p class="text-[12px] font-body text-text-2 mt-0.5">{{ opt.desc }}</p>
                  </div>
                  <div class="w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-colors"
                       [class]="wizard().sessionDuration === opt.value ? 'bg-primary border-primary' : 'bg-card border-border'">
                    @if (wizard().sessionDuration === opt.value) {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#080C10" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    } @else {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
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
            <div class="mb-7">
              <h2 class="text-[28px] font-display font-bold text-white leading-tight">Seu plano<br>está pronto.</h2>
              <p class="text-[14px] font-body text-text-2 mt-2">Agora é simples: apareça todos os dias.</p>
            </div>

            <!-- 4-week progression -->
            <div class="mb-6 rounded-2xl border border-border overflow-hidden">
              <div class="px-4 py-3 bg-card-2 border-b border-border flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <p class="text-[11px] font-body font-semibold text-text-2 uppercase tracking-widest">Progressão de 4 semanas</p>
              </div>
              @for (week of weekProgression; track week.week) {
                <div class="px-4 py-3 border-b border-border last:border-0 flex items-center gap-3 bg-card">
                  <div class="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span class="text-[11px] font-mono font-bold text-primary">{{ week.week }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-body font-semibold text-white">{{ week.tag }}</p>
                    <p class="text-[11px] font-body text-text-2 truncate">{{ week.desc }}</p>
                  </div>
                  <div class="w-14 h-1.5 bg-border rounded-full overflow-hidden shrink-0">
                    <div class="h-full bg-primary rounded-full" [style.width.%]="week.bar"></div>
                  </div>
                </div>
              }
            </div>

            <!-- Summary tags -->
            <div class="flex flex-wrap gap-2 mb-6">
              @for (goal of goalLabels(); track goal) {
                <span class="px-3 py-1 rounded-full bg-card border border-border text-[11px] font-body text-text-2">{{ goal }}</span>
              }
              <span class="px-3 py-1 rounded-full bg-card border border-border text-[11px] font-body text-text-2">{{ levelLabel() }}</span>
              <span class="px-3 py-1 rounded-full bg-card border border-border text-[11px] font-body text-text-2">Segunda a sexta</span>
              <span class="px-3 py-1 rounded-full bg-card border border-border text-[11px] font-body text-text-2">{{ wizard().sessionDuration }} min</span>
            </div>

            <h3 class="text-[11px] font-body font-semibold text-text-2 uppercase tracking-widest mb-3">Treinos da semana</h3>
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
                              type="button"
                              [disabled]="!workoutAccess(resolveStoredPlan(w)).canStart"
                              class="flex-1 py-2.5 rounded-xl border font-body font-semibold text-[13px] transition-all"
                              [class]="workoutAccess(resolveStoredPlan(w)).canStart
                                ? 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/25 active:scale-[0.98]'
                                : 'bg-card border-border text-text-2 cursor-not-allowed'">
                        {{ workoutAccess(resolveStoredPlan(w)).label }}
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
            {{ step() === 'duration' ? 'Gerar plano' : 'Continuar' }}
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
              <button type="button"
                      (click)="startPlan(previewWorkout()!); previewWorkout.set(null)"
                      [disabled]="!workoutAccess(resolveStoredPlan(previewWorkout())).canStart"
                      class="w-full py-3.5 rounded-xl font-display font-bold text-[15px] transition-all"
                      [class]="workoutAccess(resolveStoredPlan(previewWorkout())).canStart
                        ? 'bg-primary text-bg shadow-glow hover:shadow-glow-lg active:scale-[0.98]'
                        : 'bg-card border border-border text-text-2 cursor-not-allowed'">
                {{ workoutAccess(resolveStoredPlan(previewWorkout())).label }}
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
  private postService = inject(PostService);
  workoutService   = inject(WorkoutService);

  readonly stepKeys: Step[] = ['goal', 'level', 'duration'];
  showNotifications = signal(false);
  readonly goalOptions     = GOAL_OPTIONS;
  readonly levelOptions    = LEVEL_OPTIONS;
  readonly durationOptions = DURATION_OPTIONS;
  readonly weekProgression = WEEK_PROGRESSION;

  step           = signal<Step>('goal');
  wizard         = signal<WizardState>({ goals: [], level: null, sessionDuration: null });
  generated      = signal<GeneratedWorkout[]>([]);
  previewWorkout = signal<StoredPlan | GeneratedWorkout | null>(null);
  showNewPost = signal(false);

  stepIndex = computed(() => this.stepKeys.indexOf(this.step() as any));

  todayWorkout = computed(() => this.workoutService.todayWorkout());
  todayWorkoutAccess = computed(() => this.workoutService.getWorkoutAccessState(this.todayWorkout()));
  completedTodaySession = computed<WorkoutSession | null>(() => {
    const todayWorkout = this.todayWorkout();
    if (!todayWorkout || this.todayWorkoutAccess().state !== 'completed') return null;

    const history = this.workoutService.history();
    return history.find(session => session.planId === todayWorkout.id)
      ?? history.find(session => session.planName === todayWorkout.name)
      ?? null;
  });
  newPostWorkout = computed(() => {
    const session = this.completedTodaySession();
    const todayWorkout = this.todayWorkout();
    if (session) {
      return { name: session.planName, muscleGroup: session.muscleGroup };
    }
    if (todayWorkout) {
      return { name: todayWorkout.name, muscleGroup: todayWorkout.muscleGroup };
    }
    return null;
  });
  newPostSummary = computed<WorkoutPostPrefillSummary | null>(() => {
    const session = this.completedTodaySession();
    if (!session) return null;

    return {
      title: session.planName,
      muscleGroup: session.muscleGroup,
      difficulty: session.difficulty,
      workoutType: 'Musculação',
      durationMinutes: session.estimatedDuration,
      exercisesDone: session.exercisesDone,
      totalExercises: session.totalExercises,
      calories: null,
      xpEarned: session.xpEarned,
      completedAtLabel: this.formatCompletedAt(session.completedAt),
      sessionLabel: session.dateLabel === 'Hoje' ? 'Treino de hoje' : session.dateLabel,
    };
  });
  newPostTitle = computed(() => this.completedTodaySession() ? 'Postar treino do dia' : 'Novo post');
  newPostCaption = computed(() => {
    const session = this.completedTodaySession();
    if (!session) return '';

    const streak = this.workoutService.streak();
    return [
      'Treino finalizado no Repify.',
      `${session.planName} • ${session.muscleGroup}`,
      `Exercícios concluídos: ${session.exercisesDone}/${session.totalExercises}`,
      `Duração estimada: ${session.estimatedDuration} min`,
      `XP ganho: +${session.xpEarned}`,
      `Nível do treino: ${session.difficulty}`,
      streak > 0 ? `Streak atual: ${streak} dia${streak === 1 ? '' : 's'}` : '',
      'Topa encarar esse desafio comigo?',
    ].filter(Boolean).join('\n');
  });

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
      case 'goal':     return w.goals.length > 0;
      case 'level':    return !!w.level;
      case 'duration': return !!w.sessionDuration;
      default: return false;
    }
  });

  levelLabel = computed(() => {
    const map: Record<string, string> = { iniciante:'Iniciante', intermediario:'Intermediário', avancado:'Avançado' };
    return map[this.wizard().level ?? ''] ?? '';
  });

  goalLabels = computed(() => {
    const map: Record<string, string> = { hipertrofia:'Hipertrofia', emagrecimento:'Emagrecimento', forca:'Força', condicionamento:'Condicionamento' };
    return this.wizard().goals.map(goal => map[goal] ?? goal);
  });

  async ngOnInit(): Promise<void> {
    await this.workoutService.ensureHydrated();
    if (this.workoutService.hasProgram()) {
      this.step.set('plan');
    }
  }

  isToday(dayIndex: number): boolean {
    return new Date().getDay() === dayIndex;
  }

  stepDone(s: Step): boolean {
    const order: Step[] = ['goal', 'level'];
    return order.indexOf(s) < this.stepIndex();
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

  hasGoal(goal: Goal): boolean {
    return this.wizard().goals.includes(goal);
  }

  toggleGoal(goal: Goal): void {
    this.wizard.update(state => ({
      ...state,
      goals: state.goals.includes(goal)
        ? state.goals.filter(entry => entry !== goal)
        : [...state.goals, goal],
    }));
  }

  async next(): Promise<void> {
    const order: Step[] = ['goal', 'level', 'duration'];
    const idx = order.indexOf(this.step() as any);
    if (idx < order.length - 1) {
      this.step.set(order[idx + 1]);
    } else {
      const workouts = buildWorkouts(this.wizard());
      const program: ActiveProgram = {
        goal:            this.goalLabels().join(' + '),
        level:           this.wizard().level!,
        days:            FIXED_TRAINING_DAYS,
        plans:           workouts,
        createdAt:       new Date().toISOString(),
        styles:          this.wizard().goals,
        sessionDuration: this.wizard().sessionDuration!,
      };
      await this.workoutService.saveProgram(program);
      this.generated.set(workouts);
      this.step.set('result');
    }
  }

  back(): void {
    if (this.step() === 'plan') { this.location.back(); return; }
    const order: Step[] = ['goal', 'level', 'duration'];
    const idx = order.indexOf(this.step() as any);
    if (idx > 0) {
      this.step.set(order[idx - 1]);
    } else {
      this.workoutService.hasProgram() ? this.step.set('plan') : this.location.back();
    }
  }

  async startPlan(w: StoredPlan | GeneratedWorkout): Promise<void> {
    const plan = this.resolveStoredPlan(w);
    if (!plan) return;

    const access = await this.workoutService.beginWorkout(plan);
    if (!access.canStart) return;

    await this.router.navigateByUrl(`/workout/${plan.id}`);
  }

  startWorkout(w: GeneratedWorkout): void {
    void this.startPlan(w);
  }

  async confirmReset(): Promise<void> {
    if (confirm('Apagar plano atual e criar um novo?')) {
      await this.workoutService.clearProgram();
      this.wizard.set({ goals: [], level: null, sessionDuration: null });
      this.generated.set([]);
      this.step.set('goal');
    }
  }

  async reset(): Promise<void> {
    await this.workoutService.clearProgram();
    this.wizard.set({ goals: [], level: null, sessionDuration: null });
    this.generated.set([]);
    this.step.set('goal');
  }

  workoutAccess(plan: StoredPlan | null | undefined): WorkoutAccessState {
    return this.workoutService.getWorkoutAccessState(plan);
  }

  openCompletedWorkoutPostComposer(): void {
    if (this.todayWorkoutAccess().state !== 'completed') return;
    this.showNewPost.set(true);
  }

  onWorkoutPostPublished(post: WorkoutPost): void {
    post.streak = this.workoutService.streak();
    this.postService.setPendingPost(post);
    this.showNewPost.set(false);
    void this.router.navigateByUrl('/feed');
  }

  resolveStoredPlan(workout: StoredPlan | GeneratedWorkout | null): StoredPlan | null {
    if (!workout) return null;
    return this.workoutService.getPlan(workout.id) ?? null;
  }

  private formatCompletedAt(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
