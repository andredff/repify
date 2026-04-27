import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { CurrentUserRankingMetrics, RankingService } from './ranking.service';
import { environment } from '../../../environments/environment';
import { supabase } from '../supabase/supabaseClient';

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

interface WorkoutDaySession {
  date: string;
  activePlanId: string | null;
  startedAt: string | null;
  completedPlanId: string | null;
  completedAt: string | null;
  motivationalQuote: string | null;
}

interface CompleteWorkoutResponse {
  ok: boolean;
  metrics: Omit<CurrentUserRankingMetrics, 'totalKm'> & {
    yearlyGoal: number;
    xpEarned: number;
  };
}

const LS_PROGRAM  = 'repify_program';
const LS_FINISHED = 'repify_finished';
const LS_HISTORY  = 'repify_history';
const LS_XP       = 'repify_xp';
const LS_DAY_SESSION = 'repify_workout_day_session';

export const LEVELS = [
  { name: 'Novato',      minXp: 0,    color: '#8896A8', emoji: '🌱' },
  { name: 'Iniciante',   minXp: 100,  color: '#10B981', emoji: '⚡' },
  { name: 'Intermediário',minXp: 300, color: '#3B82F6', emoji: '💪' },
  { name: 'Avançado',    minXp: 700,  color: '#8B5CF6', emoji: '🔥' },
  { name: 'Elite',       minXp: 1500, color: '#F59E0B', emoji: '👑' },
  { name: 'Lenda',       minXp: 3000, color: '#EF4444', emoji: '🏆' },
];

export const ACHIEVEMENTS = [
  { id: 'first',      emoji: '🎯', name: 'Primeiro Treino',   desc: 'Complete seu primeiro treino',         condition: (h: WorkoutSession[]) => h.length >= 1 },
  { id: 'streak3',    emoji: '🔥', name: 'Trinca',            desc: '3 treinos na semana',                  condition: (h: WorkoutSession[]) => weekCount(h) >= 3 },
  { id: 'streak7',    emoji: '⚡', name: 'Semana Completa',   desc: '7 treinos no mês',                    condition: (h: WorkoutSession[]) => h.length >= 7 },
  { id: 'total10',    emoji: '💥', name: 'Dedicado',          desc: '10 treinos concluídos',               condition: (h: WorkoutSession[]) => h.length >= 10 },
  { id: 'total25',    emoji: '🏅', name: 'Consistente',       desc: '25 treinos concluídos',               condition: (h: WorkoutSession[]) => h.length >= 25 },
  { id: 'total50',    emoji: '🥇', name: 'Veterano',          desc: '50 treinos concluídos',               condition: (h: WorkoutSession[]) => h.length >= 50 },
  { id: 'xp500',      emoji: '🌟', name: '500 XP',            desc: 'Acumule 500 pontos de experiência',   condition: (_: WorkoutSession[], xp: number) => xp >= 500 },
  { id: 'xp1000',     emoji: '👑', name: '1000 XP',           desc: 'Acumule 1000 pontos de experiência',  condition: (_: WorkoutSession[], xp: number) => xp >= 1000 },
  { id: 'legs',       emoji: '🦵', name: 'Pernão',            desc: 'Complete 3 treinos de pernas',        condition: (h: WorkoutSession[]) => h.filter(s => s.muscleGroup === 'pernas').length >= 3 },
  { id: 'chest',      emoji: '🫁', name: 'Supino Master',     desc: 'Complete 3 treinos de peito',         condition: (h: WorkoutSession[]) => h.filter(s => s.muscleGroup === 'peito').length >= 3 },
];

const REPlFY_MOTIVATIONAL_QUOTES = [
  'Voce nao depende de motivacao. Voce depende de decisao.',
  'Disciplina e fazer mesmo sem vontade.',
  'Hoje foi dificil. E por isso que valeu.',
  'Seu corpo escuta o que sua rotina repete.',
  'Constancia vence talento distraido.',
  'O treino acaba. O respeito fica.',
  'Nao negocie com a versao fraca de voce.',
  'Quem aparece hoje domina o amanha.',
  'Sem desculpa. Sem atalho. So execucao.',
  'Ficar pronto e mentira. Voce comeca e vira pronto no caminho.',
];

function weekCount(history: WorkoutSession[]): number {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return history.filter(s => new Date(`${s.completedDate}T12:00:00`) >= weekStart).length;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
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

function dateLabel(isoDate: string): string {
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
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
    dateLabel: typeof session.dateLabel === 'string' ? session.dateLabel : dateLabel(completedDate),
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
  private _program  = signal<ActiveProgram | null>(this._loadProgram());
  private _finished = signal<Record<string, string>>(this._loadFinished());
  private _history  = signal<WorkoutSession[]>(this._loadHistory());
  private _totalXp  = signal<number>(this._loadXp());
  private _daySession = signal<WorkoutDaySession>(this._loadDaySession());

  // ── Public readonly state ────────────────────────────────────────────────────

  readonly program      = this._program.asReadonly();
  readonly history      = this._history.asReadonly();
  readonly totalXp      = this._totalXp.asReadonly();
  readonly hasProgram   = computed(() => !!this._program());
  readonly motivationalQuotes = REPlFY_MOTIVATIONAL_QUOTES;

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
    if (this.daySession().completedAt) {
      return true;
    }
    return this._history().some(session => session.completedDate === today);
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
    const now = new Date(); now.setHours(0,0,0,0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return this._history().filter(s => new Date(`${s.completedDate}T12:00:00`) >= weekStart).length;
  });

  readonly unlockedAchievements = computed(() => {
    const h  = this._history();
    const xp = this._totalXp();
    return ACHIEVEMENTS.filter(a => a.condition(h, xp));
  });

  readonly muscleEmoji = (mg: string) => MUSCLE_EMOJI[mg] ?? '💪';

  constructor() {
    if (typeof window !== 'undefined') {
      window.setInterval(() => {
        const nextToday = todayStr();
        if (nextToday === this._todayKey()) return;
        this._todayKey.set(nextToday);
        this._daySession.set(this._loadDaySession());
      }, 60_000);
    }

    effect(() => {
      if (!this.auth.initialized()) return;

      const userId = this.auth.user()?.id ?? null;
      if (!userId) {
        this._todayKey.set(todayStr());
        this._program.set(null);
        this._finished.set({});
        this._history.set([]);
        this._totalXp.set(0);
        this._daySession.set(createEmptyDaySession(this._todayKey()));
        return;
      }

      this._todayKey.set(todayStr());
      this._program.set(this._loadProgram());
      this._finished.set(this._loadFinished());
      this._history.set(this._loadHistory());
      this._totalXp.set(this._loadXp());
      this._daySession.set(this._loadDaySession());
    });
  }

  // ── Program management ───────────────────────────────────────────────────────

  saveProgram(program: ActiveProgram): void {
    this._program.set(program);
    localStorage.setItem(this._storageKey(LS_PROGRAM), JSON.stringify(program));
  }

  clearProgram(): void {
    this._program.set(null);
    localStorage.removeItem(this._storageKey(LS_PROGRAM));
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
    const session = this.daySession();
    const sameDay = plan.dayIndex === dayIndexFromDate(this._todayKey());
    const isTodayPlan = sameDay && todayWorkout?.id === plan.id;
    const completedToday = this.todayFinished();
    const isCompletedPlan = completedToday && ((session.completedPlanId === plan.id) || this.isFinishedToday(plan.id));

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

    if (completedToday || !isTodayPlan) {
      return {
        state: 'locked',
        canStart: false,
        canResume: false,
        isLocked: true,
        completedAt: null,
        label: weekdayAvailabilityLabel(plan.dayIndex, todayIndex),
      };
    }

    if (session.activePlanId === plan.id) {
      return {
        state: 'in_progress',
        canStart: true,
        canResume: true,
        isLocked: false,
        completedAt: null,
        label: 'Continuar treino',
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
      label: 'Iniciar treino',
    };
  }

  canOpenWorkout(plan: StoredPlan | null | undefined): boolean {
    const state = this.getWorkoutAccessState(plan);
    return state.state === 'pending' || state.state === 'in_progress';
  }

  beginWorkout(plan: StoredPlan): WorkoutAccessState {
    const state = this.getWorkoutAccessState(plan);

    if (state.state === 'pending') {
      this._saveDaySession({
        ...this.daySession(),
        activePlanId: plan.id,
        startedAt: this.daySession().startedAt ?? isoNow(),
      });
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
    const xp = xpForSession(plan, allDone);
    const motivationalQuote = this.randomMotivationalQuote();
    const previousFinished = this._finished();
    const previousHistory = this._history();
    const previousTotalXp = this._totalXp();
    const previousProfile = this.auth.profile();
    const previousRank = this.ranking.myRank();
    const previousDaySession = this.daySession();

    // finished map (for today indicator)
    this._finished.update(rec => {
      const next = { ...rec, [plan.id]: date };
      localStorage.setItem(this._storageKey(LS_FINISHED), JSON.stringify(next));
      return next;
    });

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
      const next = [session, ...h];
      localStorage.setItem(this._storageKey(LS_HISTORY), JSON.stringify(next));
      return next;
    });

    // XP
    this._totalXp.update(x => {
      const next = x + xp;
      localStorage.setItem(this._storageKey(LS_XP), String(next));
      return next;
    });

    const optimisticWorkoutsDone = (previousProfile.workouts_done ?? 0) + 1;
    const optimisticYearlyGoal = previousProfile.yearly_goal ?? 320;
    const optimisticStreakDays = this.streak();
    const optimisticMetrics: CurrentUserRankingMetrics = {
      totalXp: (previousRank?.totalXp ?? previousTotalXp) + xp,
      weeklyXp: (previousRank?.weeklyXp ?? 0) + xp,
      workoutsDone: optimisticWorkoutsDone,
      totalKm: previousRank?.totalKm ?? 0,
      streakDays: optimisticStreakDays,
    };

    this.auth.applyProfilePatch({
      workouts_done: optimisticWorkoutsDone,
      yearly_goal: optimisticYearlyGoal,
    });
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
        yearly_goal: data.metrics.yearlyGoal,
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
      this._finished.set(previousFinished);
      this._history.set(previousHistory);
      this._totalXp.set(previousTotalXp);
      this._saveDaySession(previousDaySession);
      this.auth.applyProfilePatch({
        workouts_done: previousProfile.workouts_done ?? 0,
        yearly_goal: previousProfile.yearly_goal,
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
    if (this.daySession().completedPlanId === planId && this.daySession().date === today) {
      return true;
    }
    return this._finished()[planId] === today || this._history().some(session => session.planId === planId && session.completedDate === today);
  }

  // ── Private loaders ──────────────────────────────────────────────────────────

  private _loadProgram(): ActiveProgram | null {
    try {
      const r = localStorage.getItem(this._storageKey(LS_PROGRAM));
      return r ? JSON.parse(r) : null;
    } catch {
      return null;
    }
  }
  private _loadFinished(): Record<string, string> {
    try {
      const r = localStorage.getItem(this._storageKey(LS_FINISHED));
      return r ? JSON.parse(r) : {};
    } catch {
      return {};
    }
  }
  private _loadHistory(): WorkoutSession[] {
    try {
      const r = localStorage.getItem(this._storageKey(LS_HISTORY));
      if (!r) return [];
      const parsed = JSON.parse(r);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeHistorySession).filter((session): session is WorkoutSession => !!session);
    } catch {
      return [];
    }
  }
  private _loadXp(): number {
    try {
      return Number(localStorage.getItem(this._storageKey(LS_XP)) ?? '0');
    } catch {
      return 0;
    }
  }

  private _storageKey(baseKey: string): string {
    const userId = this.auth.user()?.id;
    return userId ? `${baseKey}:${userId}` : `${baseKey}:guest`;
  }

  private _loadDaySession(): WorkoutDaySession {
    try {
      const raw = localStorage.getItem(this._storageKey(LS_DAY_SESSION));
      const parsed = raw ? JSON.parse(raw) : null;
      return normalizeSessionRecord(parsed, this._todayKey());
    } catch {
      return createEmptyDaySession(this._todayKey());
    }
  }

  private _saveDaySession(session: WorkoutDaySession): void {
    this._daySession.set(session);
    localStorage.setItem(this._storageKey(LS_DAY_SESSION), JSON.stringify(session));
  }

  private randomMotivationalQuote(): string {
    const index = Math.floor(Math.random() * REPlFY_MOTIVATIONAL_QUOTES.length);
    return REPlFY_MOTIVATIONAL_QUOTES[index] ?? REPlFY_MOTIVATIONAL_QUOTES[0];
  }

  private async _fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(`${this.API}${path}`, { ...init, headers });
  }
}

export { MUSCLE_EMOJI, DAY_INDEX_MAP };

const DAY_INDEX_MAP: Record<string, number> = {
  'Domingo':0,'Segunda':1,'Terça':2,'Quarta':3,'Quinta':4,'Sexta':5,'Sábado':6,
};
