import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { CurrentUserRankingMetrics, RankingService } from './ranking.service';
import { environment } from '../../../environments/environment';

export interface StoredExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  done: boolean;
}

export interface StoredPlan {
  id: string;
  name: string;
  muscleGroup: string;
  exercises: StoredExercise[];
  estimatedDuration: number;
  totalExercises: number;
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
  dayLabel: string;
  dayIndex: number;
}

export interface ActiveProgram {
  goal: string;
  level: string;
  days: number;
  plans: StoredPlan[];
  createdAt: string;
  styles?: string[];
  sessionDuration?: number;
}

export interface WorkoutSession {
  id: string;
  planId: string;
  planName: string;
  muscleGroup: string;
  difficulty: string;
  completedAt: string;   // ISO timestamp
  completedDate: string; // YYYY-MM-DD
  dateLabel: string;     // 'Hoje', 'Ontem', 'Seg 14/04' etc
  exercisesDone: number;
  totalExercises: number;
  estimatedDuration: number;
  xpEarned: number;
}

export type WorkoutAvailabilityState = 'pending' | 'in_progress' | 'completed' | 'locked';

export interface WorkoutAccessState {
  state: WorkoutAvailabilityState;
  canStart: boolean;
  canResume: boolean;
  isLocked: boolean;
  completedAt: string | null;
  label: string;
}

export interface WorkoutCompletionSummary {
  completedAt: string;
  motivationalQuote: string;
  state: WorkoutAvailabilityState;
}

interface WeeklyGoalAchievementContext {
  completedWeeks: number;
  currentStreak: number;
}

export interface WeeklyGoalState {
  weekKey: string;
  weekLabel: string;
  goalDays: number;
  completedDays: number;
  remainingDays: number;
  progressPct: number;
  rewardXp: number;
  isCompleted: boolean;
  isRewardClaimed: boolean;
  completedWeeks: number;
  currentStreak: number;
  bestStreak: number;
  statusLabel: string;
}

interface WorkoutDaySession {
  date: string;
  activePlanId: string | null;
  startedAt: string | null;
  completedPlanId: string | null;
  completedAt: string | null;
  motivationalQuote: string | null;
}

interface RemoteWorkoutDaySession {
  session_date: string;
  active_plan_id: string | null;
  started_at: string | null;
  completed_plan_id: string | null;
  completed_at: string | null;
  motivational_quote: string | null;
}

interface WorkoutStateResponse {
  program: ActiveProgram | null;
  history: WorkoutSession[];
  totalXp: number;
  daySession?: RemoteWorkoutDaySession | null;
}

interface CompleteWorkoutResponse {
  ok: boolean;
  metrics: Omit<CurrentUserRankingMetrics, 'totalKm'> & {
    xpEarned: number;
  };
}

const LEGACY_WORKOUT_STORAGE_KEYS = [
  'repify_program',
  'repify_finished',
  'repify_history',
  'repify_xp',
  'repify_workout_day_session',
];
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

export const LEVELS = [
  { name: 'Novato',      minXp: 0,    color: '#8896A8', emoji: '🌱' },
  { name: 'Iniciante',   minXp: 100,  color: '#10B981', emoji: '⚡' },
  { name: 'Intermediário',minXp: 300, color: '#3B82F6', emoji: '💪' },
  { name: 'Avançado',    minXp: 700,  color: '#8B5CF6', emoji: '🔥' },
  { name: 'Elite',       minXp: 1500, color: '#F59E0B', emoji: '👑' },
  { name: 'Lenda',       minXp: 3000, color: '#EF4444', emoji: '🏆' },
];

export const ACHIEVEMENTS = [
  { id: 'first',         emoji: '🎯', name: 'Primeiro Treino',    desc: 'Complete seu primeiro treino',              condition: (h: WorkoutSession[]) => h.length >= 1 },
  { id: 'streak3',       emoji: '🔥', name: 'Trinca',             desc: '3 dias treinados na semana',                condition: (h: WorkoutSession[]) => weekCount(h) >= 3 },
  { id: 'streak7',       emoji: '⚡', name: 'Semana Completa',    desc: '7 treinos no mês',                         condition: (h: WorkoutSession[]) => h.length >= 7 },
  { id: 'weekly-first',  emoji: '📅', name: 'Meta da Semana',     desc: 'Conclua sua primeira meta semanal',        condition: (_: WorkoutSession[], __: number, ctx: WeeklyGoalAchievementContext) => ctx.completedWeeks >= 1 },
  { id: 'weekly-streak', emoji: '🏁', name: 'Em Sequência',       desc: 'Feche 3 metas semanais seguidas',          condition: (_: WorkoutSession[], __: number, ctx: WeeklyGoalAchievementContext) => ctx.currentStreak >= 3 },
  { id: 'total10',       emoji: '💥', name: 'Dedicado',           desc: '10 treinos concluídos',                    condition: (h: WorkoutSession[]) => h.length >= 10 },
  { id: 'total25',       emoji: '🏅', name: 'Consistente',        desc: '25 treinos concluídos',                    condition: (h: WorkoutSession[]) => h.length >= 25 },
  { id: 'total50',       emoji: '🥇', name: 'Veterano',           desc: '50 treinos concluídos',                    condition: (h: WorkoutSession[]) => h.length >= 50 },
  { id: 'xp500',         emoji: '🌟', name: '500 XP',             desc: 'Acumule 500 pontos de experiência',        condition: (_: WorkoutSession[], xp: number) => xp >= 500 },
  { id: 'xp1000',        emoji: '👑', name: '1000 XP',            desc: 'Acumule 1000 pontos de experiência',       condition: (_: WorkoutSession[], xp: number) => xp >= 1000 },
  { id: 'legs',          emoji: '🦵', name: 'Pernão',             desc: 'Complete 3 treinos de pernas',             condition: (h: WorkoutSession[]) => h.filter(s => s.muscleGroup === 'pernas').length >= 3 },
  { id: 'chest',         emoji: '🫁', name: 'Supino Master',      desc: 'Complete 3 treinos de peito',              condition: (h: WorkoutSession[]) => h.filter(s => s.muscleGroup === 'peito').length >= 3 },
];

const REPlFY_MOTIVATIONAL_QUOTES = [
  'Hoje você venceu no ódio, ficou de pé na força e terminou no respeito.',
  'Não foi bonito. Foi bruto. E por isso funcionou.',
  'Você não treinou fofo. Você esmagou a fraqueza.',
  'A raiva certa virou gasolina. A disciplina virou resultado.',
  'Seu corpo entendeu o recado: aqui quem manda é a força.',
  'Sem carinho. Sem desculpa. Só pressão, pulso e execução.',
  'O cansaço pediu trégua. Você respondeu com peso e postura.',
  'Hoje a sua parte fraca apanhou da sua parte disciplinada.',
  'Treino concluído. Mais denso, mais duro, mais perigoso para a mediocridade.',
  'Você entrou com pressão na mente e saiu com guerra vencida no corpo.',
];

function weekCount(history: WorkoutSession[]): number {
  return countTrainingDaysInWeek(history, weekKeyFromDate(todayStr()));
}

function weekKeyFromDate(date: string): string {
  const source = new Date(`${date}T12:00:00`);
  source.setHours(0, 0, 0, 0);
  source.setDate(source.getDate() - source.getDay());
  return formatBusinessDate(source);
}

function weekLabelFromKey(weekKey: string): string {
  const start = new Date(`${weekKey}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function countTrainingDaysInWeek(history: WorkoutSession[], weekKey: string): number {
  const start = new Date(`${weekKey}T12:00:00`);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const days = new Set<string>();
  for (const session of history) {
    const completedAt = new Date(`${session.completedDate}T12:00:00`);
    if (completedAt >= start && completedAt < end) {
      days.add(session.completedDate);
    }
  }

  return days.size;
}

function normalizeCompletedWeeks(value: string[]): string[] {
  return [...new Set(value.filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry)))].sort((left, right) => right.localeCompare(left)).slice(0, 156);
}

function consecutiveCompletedWeeks(weekKeys: string[]): number {
  const normalized = normalizeCompletedWeeks(weekKeys);
  if (!normalized.length) return 0;

  let streak = 1;
  let cursor = normalized[0];

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = new Date(`${cursor}T12:00:00`);
    previous.setDate(previous.getDate() - 7);
    const expected = formatBusinessDate(previous);

    if (normalized[index] !== expected) {
      break;
    }

    streak += 1;
    cursor = normalized[index];
  }

  return streak;
}

function formatBusinessDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value ?? '0000';
  const month = parts.find(part => part.type === 'month')?.value ?? '01';
  const day = parts.find(part => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function todayStr(): string {
  return formatBusinessDate(new Date());
}

function isoNow(): string {
  return new Date().toISOString();
}

function todayDayIndex(): number {
  return new Date().getDay();
}

function dayIndexFromDate(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

function dayIndexFromIso(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? todayDayIndex() : date.getDay();
}

function dateLabel(isoDate: string): string {
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = formatBusinessDate(yesterday);
  if (isoDate === today) return 'Hoje';
  if (isoDate === yStr)  return 'Ontem';
  const d = new Date(isoDate + 'T12:00:00');
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  return `${days[d.getDay()]} ${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function nextOccurrenceDelta(targetDayIndex: number, fromDayIndex: number): number {
  const delta = (targetDayIndex - fromDayIndex + 7) % 7;
  return delta === 0 ? 7 : delta;
}

function weekdayAvailabilityLabel(dayIndex: number, fromDayIndex: number): string {
  const delta = nextOccurrenceDelta(dayIndex, fromDayIndex);
  if (delta === 1) {
    return '🔒 Disponível amanhã';
  }

  const labels = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  return `🔒 Disponível ${labels[dayIndex] ?? 'amanhã'}`;
}

function buildProgramDayIndexes(days: number, startDayIndex: number): number[] {
  const patterns: Record<number, number[]> = {
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
  };

  const offsets = patterns[days] ?? Array.from({ length: days }, (_, index) => index);
  return offsets.map(offset => (startDayIndex + offset) % 7);
}

function weekdayLabel(dayIndex: number): string {
  const labels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return labels[dayIndex] ?? `Dia ${dayIndex}`;
}

function normalizeProgram(program: ActiveProgram | null): ActiveProgram | null {
  if (!program) return null;
  if (!Array.isArray(program.plans) || !program.plans.length) return program;

  const dayIndexes = buildProgramDayIndexes(program.days, dayIndexFromIso(program.createdAt));

  return {
    ...program,
    plans: program.plans.map((plan, index) => ({
      ...plan,
      dayIndex: dayIndexes[index] ?? plan.dayIndex,
      dayLabel: weekdayLabel(dayIndexes[index] ?? plan.dayIndex),
    })),
  };
}

function createEmptyDaySession(date: string): WorkoutDaySession {
  return {
    date,
    activePlanId: null,
    startedAt: null,
    completedPlanId: null,
    completedAt: null,
    motivationalQuote: null,
  };
}

function normalizeSessionRecord(raw: unknown, today: string): WorkoutDaySession {
  if (!raw || typeof raw !== 'object') {
    return createEmptyDaySession(today);
  }

  const session = raw as Partial<WorkoutDaySession>;
  if (session.date !== today) {
    return createEmptyDaySession(today);
  }

  return {
    date: today,
    activePlanId: typeof session.activePlanId === 'string' ? session.activePlanId : null,
    startedAt: typeof session.startedAt === 'string' ? session.startedAt : null,
    completedPlanId: typeof session.completedPlanId === 'string' ? session.completedPlanId : null,
    completedAt: typeof session.completedAt === 'string' ? session.completedAt : null,
    motivationalQuote: typeof session.motivationalQuote === 'string' ? session.motivationalQuote : null,
  };
}

function normalizeRemoteDaySession(raw: RemoteWorkoutDaySession | null | undefined, today: string): WorkoutDaySession {
  if (!raw) {
    return createEmptyDaySession(today);
  }

  return normalizeSessionRecord({
    date: raw.session_date,
    activePlanId: raw.active_plan_id,
    startedAt: raw.started_at,
    completedPlanId: raw.completed_plan_id,
    completedAt: raw.completed_at,
    motivationalQuote: raw.motivational_quote,
  }, today);
}

function normalizeHistorySession(raw: unknown): WorkoutSession | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const session = raw as Partial<WorkoutSession>;
  const rawCompletedAt = typeof session.completedAt === 'string' ? session.completedAt : '';
  const completedDate = typeof session.completedDate === 'string'
    ? session.completedDate
    : rawCompletedAt.slice(0, 10);

  if (!completedDate) {
    return null;
  }

  const completedAt = rawCompletedAt.length > 10 ? rawCompletedAt : `${completedDate}T12:00:00.000Z`;

  return {
    id: typeof session.id === 'string' ? session.id : crypto.randomUUID(),
    planId: typeof session.planId === 'string' ? session.planId : '',
    planName: typeof session.planName === 'string' ? session.planName : '',
    muscleGroup: typeof session.muscleGroup === 'string' ? session.muscleGroup : 'full',
    difficulty: typeof session.difficulty === 'string' ? session.difficulty : 'Iniciante',
    completedAt,
    completedDate,
    dateLabel: typeof session.dateLabel === 'string' && session.dateLabel.trim().length ? session.dateLabel : dateLabel(completedDate),
    exercisesDone: typeof session.exercisesDone === 'number' ? session.exercisesDone : 0,
    totalExercises: typeof session.totalExercises === 'number' ? session.totalExercises : 0,
    estimatedDuration: typeof session.estimatedDuration === 'number' ? session.estimatedDuration : 0,
    xpEarned: typeof session.xpEarned === 'number' ? session.xpEarned : 0,
  };
}

function xpForSession(plan: StoredPlan, allDone: boolean): number {
  const base = 50;
  const diffBonus: Record<string, number> = { 'Iniciante': 0, 'Intermediário': 20, 'Avançado': 40 };
  const perfectBonus = allDone ? 30 : 0;
  return base + (diffBonus[plan.difficulty] ?? 0) + perfectBonus;
}

const MUSCLE_EMOJI: Record<string, string> = {
  peito:'🫁', costas:'🔙', pernas:'🦵', ombros:'💪',
  biceps:'💪', triceps:'🤜', abdomen:'⚡', full:'🔥',
};

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private auth    = inject(AuthService);
  private ranking = inject(RankingService);
  private readonly API = environment.apiBaseUrl;
  private _todayKey = signal(todayStr());
  private _program  = signal<ActiveProgram | null>(null);
  private _history  = signal<WorkoutSession[]>([]);
  private _totalXp  = signal<number>(0);
  private _daySession = signal<WorkoutDaySession>(createEmptyDaySession(todayStr()));
  private _hydrated = signal(false);
  private _loadVersion = 0;
  private _loadPromise: Promise<void> | null = null;
  private _weeklyGoalClaiming = false;

  // ── Public readonly state ────────────────────────────────────────────────────

  readonly program      = this._program.asReadonly();
  readonly history      = this._history.asReadonly();
  readonly totalXp      = this._totalXp.asReadonly();
  readonly hasProgram   = computed(() => !!this._program());
  readonly motivationalQuotes = REPlFY_MOTIVATIONAL_QUOTES;
  readonly hydrated = this._hydrated.asReadonly();

  readonly todayKey = this._todayKey.asReadonly();
  readonly daySession = computed(() => {
    const today = this._todayKey();
    const session = this._daySession();
    return session.date === today ? session : createEmptyDaySession(today);
  });

  readonly todayWorkout = computed<StoredPlan | null>(() => {
    const prog = this._program();
    if (!prog) return null;
    return prog.plans.find(p => p.dayIndex === dayIndexFromDate(this._todayKey())) ?? null;
  });

  readonly todayFinished = computed<boolean>(() => {
    const today = this._todayKey();
    const session = this.currentProgramDaySession();
    if (session.completedAt) {
      return true;
    }
    return this._history().some(historySession => this.isCurrentProgramCompletion(historySession, today));
  });

  readonly workoutInProgress = computed<boolean>(() => !!this.daySession().activePlanId && !this.todayFinished());
  readonly activePlanId = computed(() => this.daySession().activePlanId);
  readonly completedAt = computed(() => this.daySession().completedAt);
  readonly completionQuote = computed(() => this.daySession().motivationalQuote);

  readonly currentLevel = computed(() => {
    const xp = this._totalXp();
    let lvl = LEVELS[0];
    for (const l of LEVELS) { if (xp >= l.minXp) lvl = l; else break; }
    return lvl;
  });

  readonly nextLevel = computed(() => {
    const xp = this._totalXp();
    return LEVELS.find(l => l.minXp > xp) ?? null;
  });

  readonly xpToNextLevel = computed(() => {
    const next = this.nextLevel();
    return next ? next.minXp - this._totalXp() : 0;
  });

  readonly levelProgress = computed(() => {
    const cur  = this.currentLevel();
    const next = this.nextLevel();
    if (!next) return 100;
    const xp  = this._totalXp();
    return Math.round(((xp - cur.minXp) / (next.minXp - cur.minXp)) * 100);
  });

  readonly streak = computed(() => {
    const h = [...this._history()].sort((a,b) => b.completedAt.localeCompare(a.completedAt));
    if (!h.length) return 0;
    let streak = 0;
    let cursor = new Date(); cursor.setHours(0,0,0,0);
    for (let i = 0; i < 60; i++) {
      const dateStr = cursor.toISOString().slice(0,10);
      if (h.some(s => s.completedDate === dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  });

  readonly weekSessions = computed(() => {
    return countTrainingDaysInWeek(this._history(), weekKeyFromDate(this._todayKey()));
  });

  readonly weeklyGoalState = computed<WeeklyGoalState>(() => {
    const goalDays = Math.min(Math.max(Number(this.auth.profile().weekly_goal_days ?? 0), 0), 5);
    const weekKey = weekKeyFromDate(this._todayKey());
    const completedDays = countTrainingDaysInWeek(this._history(), weekKey);
    const rewardXp = goalDays > 0 ? goalDays * 50 : 0;
    const completedWeeks = normalizeCompletedWeeks(this.auth.profile().weekly_goal_completed_weeks ?? []);
    const isRewardClaimed = completedWeeks.includes(weekKey);
    const isCompleted = goalDays > 0 && completedDays >= goalDays;
    const remainingDays = goalDays > 0 ? Math.max(goalDays - completedDays, 0) : 0;
    const progressPct = goalDays > 0 ? Math.min(Math.round((completedDays / goalDays) * 100), 100) : 0;
    const currentStreak = consecutiveCompletedWeeks(completedWeeks);
    const bestStreak = Math.max(Number(this.auth.profile().weekly_goal_best_streak ?? 0), currentStreak);

    return {
      weekKey,
      weekLabel: weekLabelFromKey(weekKey),
      goalDays,
      completedDays,
      remainingDays,
      progressPct,
      rewardXp,
      isCompleted,
      isRewardClaimed,
      completedWeeks: completedWeeks.length,
      currentStreak,
      bestStreak,
      statusLabel: goalDays <= 0
        ? 'Escolha uma meta para começar sua sequência semanal.'
        : isRewardClaimed
          ? `Meta concluída. +${rewardXp} XP já liberados.`
          : isCompleted
            ? `Meta batida. Recompensa de +${rewardXp} XP liberada.`
            : `${remainingDays} dia${remainingDays === 1 ? '' : 's'} para fechar a semana.`,
    };
  });

  readonly unlockedAchievements = computed(() => {
    const h  = this._history();
    const xp = this._totalXp();
    const weeklyGoal = this.weeklyGoalState();
    return ACHIEVEMENTS.filter(a => a.condition(h, xp, {
      completedWeeks: weeklyGoal.completedWeeks,
      currentStreak: weeklyGoal.currentStreak,
    }));
  });

  readonly muscleEmoji = (mg: string) => MUSCLE_EMOJI[mg] ?? '💪';

  constructor() {
    if (typeof window !== 'undefined') {
      window.setInterval(() => {
        const nextToday = todayStr();
        if (nextToday === this._todayKey()) return;
        this._todayKey.set(nextToday);
        this._daySession.set(createEmptyDaySession(nextToday));
        this._hydrated.set(false);
        void this.reloadState();
      }, 60_000);
    }

    effect(() => {
      if (!this.auth.initialized()) return;

      const userId = this.auth.user()?.id ?? null;
      if (!userId) {
        this._todayKey.set(todayStr());
        this._resetState();
        this._clearLegacyWorkoutStorage();
        this._hydrated.set(true);
        return;
      }

      this._todayKey.set(todayStr());
      this._hydrated.set(false);
      void this.reloadState();
    });

    effect(() => {
      const weeklyGoal = this.weeklyGoalState();
      const userId = this.auth.user()?.id;
      if (!userId || !this._hydrated()) return;
      if (!weeklyGoal.goalDays || !weeklyGoal.isCompleted || weeklyGoal.isRewardClaimed) return;
      void this.claimWeeklyGoalReward(weeklyGoal);
    });
  }

  // ── Program management ───────────────────────────────────────────────────────

  async saveProgram(program: ActiveProgram): Promise<void> {
    if (!this.auth.user()) {
      throw new Error('Usuário não autenticado.');
    }

    const previousProgram = this._program();
    const previousDaySession = this.daySession();
    this._program.set(program);
    this._saveDaySession(createEmptyDaySession(this._todayKey()));

    try {
      const res = await this._fetch('/api/workouts/program', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(program),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null) as { error?: string; details?: string } | null;
        const message = [errorBody?.error, errorBody?.details].filter(Boolean).join(' ');
        throw new Error(message || 'Falha ao salvar programa de treino.');
      }
    } catch (error) {
      this._program.set(previousProgram);
      this._saveDaySession(previousDaySession);
      throw error;
    }
  }

  async clearProgram(): Promise<void> {
    if (!this.auth.user()) {
      throw new Error('Usuário não autenticado.');
    }

    const previousProgram = this._program();
    this._program.set(null);

    try {
      const res = await this._fetch('/api/workouts/program', { method: 'DELETE' });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null) as { error?: string; details?: string } | null;
        const message = [errorBody?.error, errorBody?.details].filter(Boolean).join(' ');
        throw new Error(message || 'Falha ao limpar programa de treino.');
      }
    } catch (error) {
      this._program.set(previousProgram);
      throw error;
    }
  }

  getPlan(id: string): StoredPlan | null {
    return this._program()?.plans.find(p => p.id === id) ?? null;
  }

  getWorkoutAccessState(plan: StoredPlan | null | undefined): WorkoutAccessState {
    const todayIndex = dayIndexFromDate(this._todayKey());

    if (!plan) {
      return {
        state: 'locked',
        canStart: false,
        canResume: false,
        isLocked: true,
        completedAt: null,
        label: '🔒 Disponível amanhã',
      };
    }

    const todayWorkout = this.todayWorkout();
    const session = this.currentProgramDaySession();
    const sameDay = plan.dayIndex === dayIndexFromDate(this._todayKey());
    const isTodayPlan = sameDay && todayWorkout?.id === plan.id;
    const completedToday = this.todayFinished();
    const isCompletedPlan = completedToday && ((session.completedPlanId === plan.id) || this.isFinishedToday(plan.id));

    if (session.activePlanId === plan.id) {
      return {
        state: 'in_progress',
        canStart: true,
        canResume: true,
        isLocked: false,
        completedAt: session.completedAt,
        label: completedToday ? 'Continuar sem XP' : 'Continuar treino',
      };
    }

    if (isCompletedPlan) {
      return {
        state: 'completed',
        canStart: false,
        canResume: false,
        isLocked: false,
        completedAt: session.completedAt,
        label: 'Treino concluido',
      };
    }

    if (!isTodayPlan) {
      return {
        state: 'locked',
        canStart: false,
        canResume: false,
        isLocked: true,
        completedAt: null,
        label: weekdayAvailabilityLabel(plan.dayIndex, todayIndex),
      };
    }

    if (session.activePlanId && session.activePlanId !== plan.id) {
      return {
        state: 'locked',
        canStart: false,
        canResume: false,
        isLocked: true,
        completedAt: null,
        label: weekdayAvailabilityLabel(plan.dayIndex, todayIndex),
      };
    }

    return {
      state: 'pending',
      canStart: true,
      canResume: false,
      isLocked: false,
      completedAt: null,
      label: completedToday ? 'Treinar sem XP' : 'Iniciar treino',
    };
  }

  canOpenWorkout(plan: StoredPlan | null | undefined): boolean {
    const state = this.getWorkoutAccessState(plan);
    return state.state === 'pending' || state.state === 'in_progress';
  }

  async beginWorkout(plan: StoredPlan): Promise<WorkoutAccessState> {
    const state = this.getWorkoutAccessState(plan);

    if (state.state === 'pending') {
      const previousDaySession = this.currentProgramDaySession();
      this._saveDaySession({
        ...previousDaySession,
        activePlanId: plan.id,
        startedAt: previousDaySession.startedAt ?? isoNow(),
      });

      try {
        const res = await this._fetch('/api/workouts/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan.id }),
        });

        const data = await res.json().catch(() => null) as { error?: string; daySession?: RemoteWorkoutDaySession | null } | null;
        if (!res.ok) {
          if (data?.daySession) {
            this._saveDaySession(normalizeRemoteDaySession(data.daySession, this._todayKey()));
          } else {
            this._saveDaySession(previousDaySession);
          }
          throw new Error(data?.error || 'Falha ao iniciar treino.');
        }

        this._saveDaySession(normalizeRemoteDaySession(data?.daySession ?? null, this._todayKey()));
      } catch (error) {
        if (!this.daySession().activePlanId) {
          this._saveDaySession(previousDaySession);
        }
        throw error;
      }

      return this.getWorkoutAccessState(plan);
    }

    return state;
  }

  // ── Session tracking ─────────────────────────────────────────────────────────

  async markFinished(plan: StoredPlan, exercisesDone: number): Promise<WorkoutCompletionSummary> {
    const access = this.getWorkoutAccessState(plan);
    if (access.state === 'completed') {
      return {
        completedAt: this.daySession().completedAt ?? isoNow(),
        motivationalQuote: this.daySession().motivationalQuote ?? this.randomMotivationalQuote(),
        state: 'completed',
      };
    }

    if (access.state === 'locked') {
      throw new Error('O treino de hoje nao esta disponivel agora.');
    }

    const date = this._todayKey();
    const completedAt = isoNow();
    const allDone = exercisesDone === plan.totalExercises;
    const alreadyRewardedToday = this._history().some(session => session.completedDate === date && session.xpEarned > 0);
    const xp = alreadyRewardedToday ? 0 : xpForSession(plan, allDone);
    const motivationalQuote = this.randomMotivationalQuote();
    const previousHistory = this._history();
    const previousTotalXp = this._totalXp();
    const previousProfile = this.auth.profile();
    const previousRank = this.ranking.myRank();
    const previousDaySession = this.daySession();

    this._saveDaySession({
      date,
      activePlanId: plan.id,
      startedAt: previousDaySession.startedAt ?? completedAt,
      completedPlanId: plan.id,
      completedAt,
      motivationalQuote,
    });

    // history
    const session: WorkoutSession = {
      id:               crypto.randomUUID(),
      planId:           plan.id,
      planName:         plan.name,
      muscleGroup:      plan.muscleGroup,
      difficulty:       plan.difficulty,
      completedAt,
      completedDate:    date,
      dateLabel:        dateLabel(date),
      exercisesDone,
      totalExercises:   plan.totalExercises,
      estimatedDuration: plan.estimatedDuration,
      xpEarned:         xp,
    };
    this._history.update(h => {
      return [session, ...h];
    });

    // XP
    if (xp > 0) {
      this._totalXp.update(x => {
        return x + xp;
      });
    }

    const optimisticWorkoutsDone = alreadyRewardedToday
      ? (previousProfile.workouts_done ?? 0)
      : (previousProfile.workouts_done ?? 0) + 1;
    const optimisticStreakDays = this.streak();
    const optimisticMetrics: CurrentUserRankingMetrics = {
      totalXp: (previousRank?.totalXp ?? previousTotalXp) + xp,
      weeklyXp: (previousRank?.weeklyXp ?? 0) + xp,
      workoutsDone: optimisticWorkoutsDone,
      totalKm: previousRank?.totalKm ?? 0,
      streakDays: optimisticStreakDays,
    };

    this.auth.applyProfilePatch({ workouts_done: optimisticWorkoutsDone });
    this.ranking.syncCurrentUserMetrics(optimisticMetrics);

    try {
      const res = await this._fetch('/api/workouts/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          muscleGroup: plan.muscleGroup,
          difficulty: plan.difficulty,
          completedAt,
          estimatedDuration: plan.estimatedDuration,
          totalExercises: plan.totalExercises,
          exercisesDone,
          streakDays: optimisticStreakDays,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null) as { error?: string; details?: string } | null;
        const message = [errorBody?.error, errorBody?.details].filter(Boolean).join(' ');
        throw new Error(message || 'Falha ao concluir treino.');
      }

      const data = await res.json() as CompleteWorkoutResponse;
      this.auth.applyProfilePatch({
        workouts_done: data.metrics.workoutsDone,
      });
      this.ranking.syncCurrentUserMetrics({
        totalXp: data.metrics.totalXp,
        weeklyXp: data.metrics.weeklyXp,
        workoutsDone: data.metrics.workoutsDone,
        totalKm: previousRank?.totalKm ?? 0,
        streakDays: data.metrics.streakDays,
      });
      setTimeout(() => void this.ranking.load(true), 250);
    } catch (error) {
      this._history.set(previousHistory);
      this._totalXp.set(previousTotalXp);
      this._saveDaySession(previousDaySession);
      this.auth.applyProfilePatch({
        workouts_done: previousProfile.workouts_done ?? 0,
      });

      if (previousRank) {
        this.ranking.syncCurrentUserMetrics({
          totalXp: previousRank.totalXp,
          weeklyXp: previousRank.weeklyXp,
          workoutsDone: previousRank.workoutsDone,
          totalKm: previousRank.totalKm,
          streakDays: previousRank.streakDays,
        });
      }

      throw error;
    }

    return {
      completedAt,
      motivationalQuote,
      state: 'completed',
    };
  }

  isFinishedToday(planId: string): boolean {
    const today = this._todayKey();
    const daySession = this.currentProgramDaySession();
    if (daySession.completedPlanId === planId && daySession.date === today) {
      return true;
    }
    return this._history().some(session => this.isCurrentProgramCompletion(session, today, planId));
  }

  private currentProgramDaySession(): WorkoutDaySession {
    const session = this.daySession();
    const currentProgram = this._program();

    if (!currentProgram) {
      return createEmptyDaySession(this._todayKey());
    }

    const currentPlanIds = new Set(currentProgram.plans.map(plan => plan.id));
    const activeBelongsToCurrentProgram = !!session.activePlanId
      && currentPlanIds.has(session.activePlanId)
      && this.isOnOrAfterProgramCreation(session.startedAt ?? session.completedAt);
    const completedBelongsToCurrentProgram = !!session.completedPlanId
      && currentPlanIds.has(session.completedPlanId)
      && this.isOnOrAfterProgramCreation(session.completedAt ?? session.startedAt);

    return {
      date: session.date,
      activePlanId: activeBelongsToCurrentProgram ? session.activePlanId : null,
      startedAt: activeBelongsToCurrentProgram ? session.startedAt : null,
      completedPlanId: completedBelongsToCurrentProgram ? session.completedPlanId : null,
      completedAt: completedBelongsToCurrentProgram ? session.completedAt : null,
      motivationalQuote: completedBelongsToCurrentProgram ? session.motivationalQuote : null,
    };
  }

  private isCurrentProgramCompletion(session: WorkoutSession, today: string, planId?: string): boolean {
    const currentProgram = this._program();
    if (!currentProgram) return false;
    if (session.completedDate !== today) return false;
    if (planId && session.planId !== planId) return false;

    const currentPlanIds = new Set(currentProgram.plans.map(plan => plan.id));
    if (!currentPlanIds.has(session.planId)) return false;

    return this.isOnOrAfterProgramCreation(session.completedAt);
  }

  private isOnOrAfterProgramCreation(value: string | null | undefined): boolean {
    const createdAt = this._program()?.createdAt;
    if (!createdAt || !value) return false;

    const createdAtMs = new Date(createdAt).getTime();
    const valueMs = new Date(value).getTime();

    if (Number.isNaN(createdAtMs) || Number.isNaN(valueMs)) {
      return false;
    }

    return valueMs >= createdAtMs;
  }

  // ── Private loaders ──────────────────────────────────────────────────────────

  async ensureHydrated(): Promise<void> {
    if (this._hydrated()) {
      return;
    }

    await this.reloadState();
  }

  async reloadState(): Promise<void> {
    if (this._loadPromise) {
      return this._loadPromise;
    }

    const userId = this.auth.user()?.id;
    if (!userId) {
      this._resetState();
      this._hydrated.set(true);
      return;
    }

    const currentVersion = ++this._loadVersion;
    this._loadPromise = (async () => {
      try {
        const res = await this._fetch('/api/workouts/state');
        if (!res.ok) {
          throw new Error('Falha ao carregar estado do treino.');
        }

        const payload = await res.json() as WorkoutStateResponse;
        if (currentVersion !== this._loadVersion) {
          return;
        }

        const history = Array.isArray(payload.history)
          ? payload.history.map(normalizeHistorySession).filter((session): session is WorkoutSession => !!session)
          : [];

        this._program.set(normalizeProgram(payload.program ?? null));
        this._history.set(history);
        this._totalXp.set(Number(payload.totalXp ?? history.reduce((sum, session) => sum + session.xpEarned, 0)));
        this._daySession.set(normalizeRemoteDaySession(payload.daySession ?? null, this._todayKey()));
      } catch {
        if (currentVersion !== this._loadVersion) {
          return;
        }
        this._resetState();
      } finally {
        if (currentVersion === this._loadVersion) {
          this._hydrated.set(true);
        }
        this._clearLegacyWorkoutStorage();
        this._loadPromise = null;
      }
    })();

    return this._loadPromise;
  }

  private _saveDaySession(session: WorkoutDaySession): void {
    this._daySession.set(session);
  }

  private _resetState(): void {
    this._program.set(null);
    this._history.set([]);
    this._totalXp.set(0);
    this._daySession.set(createEmptyDaySession(this._todayKey()));
  }

  private _clearLegacyWorkoutStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const userId = this.auth.user()?.id;
    const suffixes = userId ? [userId, 'guest'] : ['guest'];

    for (const baseKey of LEGACY_WORKOUT_STORAGE_KEYS) {
      for (const suffix of suffixes) {
        localStorage.removeItem(`${baseKey}:${suffix}`);
      }
    }
  }

  private randomMotivationalQuote(): string {
    const index = Math.floor(Math.random() * REPlFY_MOTIVATIONAL_QUOTES.length);
    return REPlFY_MOTIVATIONAL_QUOTES[index] ?? REPlFY_MOTIVATIONAL_QUOTES[0];
  }

  private async claimWeeklyGoalReward(state: WeeklyGoalState): Promise<void> {
    if (this._weeklyGoalClaiming) {
      return;
    }

    const userId = this.auth.user()?.id;
    if (!userId || !state.goalDays || state.isRewardClaimed || !state.isCompleted) {
      return;
    }

    this._weeklyGoalClaiming = true;

    const previousWeeks = normalizeCompletedWeeks(this.auth.profile().weekly_goal_completed_weeks ?? []);
    const previousBestStreak = Number(this.auth.profile().weekly_goal_best_streak ?? 0);
    const nextWeeks = normalizeCompletedWeeks([state.weekKey, ...previousWeeks]);
    const nextStreak = consecutiveCompletedWeeks(nextWeeks);
    const nextBestStreak = Math.max(Number(this.auth.profile().weekly_goal_best_streak ?? 0), nextStreak);
    const nextPatch = {
      weekly_goal_completed_weeks: nextWeeks,
      weekly_goal_best_streak: nextBestStreak,
    };
    const previousPatch = {
      weekly_goal_completed_weeks: previousWeeks,
      weekly_goal_best_streak: previousBestStreak,
    };
    let persisted = false;

    this.auth.applyProfilePatch(nextPatch);

    try {
      await this.auth.updateProfile(nextPatch);
      persisted = true;

      const awarded = await this.ranking.recordXp('weekly_goal_bonus', state.rewardXp);
      if (!awarded) {
        throw new Error('weekly-goal-bonus-failed');
      }
    } catch {
      this.auth.applyProfilePatch(previousPatch);

      if (persisted) {
        try {
          await this.auth.updateProfile(previousPatch);
        } catch {
          // Keep local state consistent even if the metadata rollback fails remotely.
        }
      }
    } finally {
      this._weeklyGoalClaiming = false;
    }
  }

  private async _fetch(path: string, init: RequestInit = {}): Promise<Response> {
    return this.auth.apiFetch(path, init);
  }
}

export { MUSCLE_EMOJI, DAY_INDEX_MAP };

const DAY_INDEX_MAP: Record<string, number> = {
  'Domingo':0,'Segunda':1,'Terça':2,'Quarta':3,'Quinta':4,'Sexta':5,'Sábado':6,
};
