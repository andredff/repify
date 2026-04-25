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
  dayLabel: string;   // ex: 'Segunda', 'Terça'
  dayIndex: number;   // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
}

export interface ActiveProgram {
  goal: string;
  level: string;
  days: number;
  plans: StoredPlan[];
  createdAt: string;
}

const LS_PROGRAM  = 'repify_program';
const LS_FINISHED = 'repify_finished'; // Record<planId, dateString 'YYYY-MM-DD'>

const DAY_INDEX_MAP: Record<string, number> = {
  'Domingo':   0,
  'Segunda':   1,
  'Terça':     2,
  'Quarta':    3,
  'Quinta':    4,
  'Sexta':     5,
  'Sábado':    6,
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayDayIndex(): number {
  return new Date().getDay(); // 0=Dom … 6=Sab
}

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private _program  = signal<ActiveProgram | null>(this._loadProgram());
  private _finished = signal<Record<string, string>>(this._loadFinished());

  // ── Public state ─────────────────────────────────────────────────────────────

  readonly program = this._program.asReadonly();

  readonly hasProgram = computed(() => !!this._program());

  /** Treino agendado para hoje (null se não houver) */
  readonly todayWorkout = computed<StoredPlan | null>(() => {
    const prog = this._program();
    if (!prog) return null;
    const today = todayDayIndex();
    return prog.plans.find(p => p.dayIndex === today) ?? null;
  });

  /** True se o treino de hoje já foi concluído hoje */
  readonly todayFinished = computed<boolean>(() => {
    const tw = this.todayWorkout();
    if (!tw) return false;
    return this._finished()[tw.id] === todayStr();
  });

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

  // ── Finish tracking ──────────────────────────────────────────────────────────

  markFinished(planId: string): void {
    this._finished.update(rec => {
      const next = { ...rec, [planId]: todayStr() };
      localStorage.setItem(LS_FINISHED, JSON.stringify(next));
      return next;
    });
  }

  isFinishedToday(planId: string): boolean {
    return this._finished()[planId] === todayStr();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _loadProgram(): ActiveProgram | null {
    try {
      const raw = localStorage.getItem(LS_PROGRAM);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private _loadFinished(): Record<string, string> {
    try {
      const raw = localStorage.getItem(LS_FINISHED);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
}

export { DAY_INDEX_MAP };
