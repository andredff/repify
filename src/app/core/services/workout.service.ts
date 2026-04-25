import { Injectable, signal, computed } from '@angular/core';

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
  completedAt: string;   // ISO date string
  dateLabel: string;     // 'Hoje', 'Ontem', 'Seg 14/04' etc
  exercisesDone: number;
  totalExercises: number;
  estimatedDuration: number;
  xpEarned: number;
}

const LS_PROGRAM  = 'repify_program';
const LS_FINISHED = 'repify_finished';
const LS_HISTORY  = 'repify_history';
const LS_XP       = 'repify_xp';

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

function weekCount(history: WorkoutSession[]): number {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return history.filter(s => new Date(s.completedAt) >= weekStart).length;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayDayIndex(): number {
  return new Date().getDay();
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
  private _program  = signal<ActiveProgram | null>(this._loadProgram());
  private _finished = signal<Record<string, string>>(this._loadFinished());
  private _history  = signal<WorkoutSession[]>(this._loadHistory());
  private _totalXp  = signal<number>(this._loadXp());

  // ── Public readonly state ────────────────────────────────────────────────────

  readonly program      = this._program.asReadonly();
  readonly history      = this._history.asReadonly();
  readonly totalXp      = this._totalXp.asReadonly();
  readonly hasProgram   = computed(() => !!this._program());

  readonly todayWorkout = computed<StoredPlan | null>(() => {
    const prog = this._program();
    if (!prog) return null;
    return prog.plans.find(p => p.dayIndex === todayDayIndex()) ?? null;
  });

  readonly todayFinished = computed<boolean>(() => {
    const tw = this.todayWorkout();
    if (!tw) return false;
    return this._finished()[tw.id] === todayStr();
  });

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
      if (h.some(s => s.completedAt === dateStr)) {
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
    return this._history().filter(s => new Date(s.completedAt + 'T12:00:00') >= weekStart).length;
  });

  readonly unlockedAchievements = computed(() => {
    const h  = this._history();
    const xp = this._totalXp();
    return ACHIEVEMENTS.filter(a => a.condition(h, xp));
  });

  readonly muscleEmoji = (mg: string) => MUSCLE_EMOJI[mg] ?? '💪';

  // ── Program management ───────────────────────────────────────────────────────

  saveProgram(program: ActiveProgram): void {
    this._program.set(program);
    localStorage.setItem(LS_PROGRAM, JSON.stringify(program));
  }

  clearProgram(): void {
    this._program.set(null);
    localStorage.removeItem(LS_PROGRAM);
  }

  getPlan(id: string): StoredPlan | null {
    return this._program()?.plans.find(p => p.id === id) ?? null;
  }

  // ── Session tracking ─────────────────────────────────────────────────────────

  markFinished(plan: StoredPlan, exercisesDone: number): void {
    const date  = todayStr();
    const allDone = exercisesDone === plan.totalExercises;
    const xp    = xpForSession(plan, allDone);

    // finished map (for today indicator)
    this._finished.update(rec => {
      const next = { ...rec, [plan.id]: date };
      localStorage.setItem(LS_FINISHED, JSON.stringify(next));
      return next;
    });

    // history
    const session: WorkoutSession = {
      id:               crypto.randomUUID(),
      planId:           plan.id,
      planName:         plan.name,
      muscleGroup:      plan.muscleGroup,
      difficulty:       plan.difficulty,
      completedAt:      date,
      dateLabel:        dateLabel(date),
      exercisesDone,
      totalExercises:   plan.totalExercises,
      estimatedDuration: plan.estimatedDuration,
      xpEarned:         xp,
    };
    this._history.update(h => {
      const next = [session, ...h];
      localStorage.setItem(LS_HISTORY, JSON.stringify(next));
      return next;
    });

    // XP
    this._totalXp.update(x => {
      const next = x + xp;
      localStorage.setItem(LS_XP, String(next));
      return next;
    });
  }

  isFinishedToday(planId: string): boolean {
    return this._finished()[planId] === todayStr();
  }

  // ── Private loaders ──────────────────────────────────────────────────────────

  private _loadProgram(): ActiveProgram | null {
    try { const r = localStorage.getItem(LS_PROGRAM); return r ? JSON.parse(r) : null; } catch { return null; }
  }
  private _loadFinished(): Record<string, string> {
    try { const r = localStorage.getItem(LS_FINISHED); return r ? JSON.parse(r) : {}; } catch { return {}; }
  }
  private _loadHistory(): WorkoutSession[] {
    try { const r = localStorage.getItem(LS_HISTORY); return r ? JSON.parse(r) : []; } catch { return []; }
  }
  private _loadXp(): number {
    try { return Number(localStorage.getItem(LS_XP) ?? '0'); } catch { return 0; }
  }
}

export { MUSCLE_EMOJI, DAY_INDEX_MAP };

const DAY_INDEX_MAP: Record<string, number> = {
  'Domingo':0,'Segunda':1,'Terça':2,'Quarta':3,'Quinta':4,'Sexta':5,'Sábado':6,
};
