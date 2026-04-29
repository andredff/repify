import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

// ── Public types ──────────────────────────────────────────────────────────────

export type WorkoutType = 'push' | 'pull' | 'legs';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string; // bodyPart normalized
  target: string;
  equipment: string;
  gifUrl: string;
}

export interface ExerciseMatch {
  gif: string;
  target: string;
  equipment: string;
}

// ── Muscle group → ExerciseDB bodyPart mapping ────────────────────────────────

const MUSCLE_TO_BODY_PARTS: Record<string, string[]> = {
  peito:        ['chest'],
  costas:       ['back'],
  pernas:       ['upper legs', 'lower legs'],
  ombros:       ['shoulders'],
  biceps:       ['upper arms'],
  triceps:      ['upper arms'],
  abdomen:      ['waist'],
  full:         ['chest', 'back', 'upper legs'],
  push:         ['chest', 'shoulders', 'upper arms'],
  pull:         ['back', 'upper arms'],
  legs:         ['upper legs', 'lower legs'],
};

// ── PT exercise name → English keyword fragments for fuzzy matching ───────────
// Each array contains ordered keywords — first match wins

const PT_TO_EN_KEYWORDS: Record<string, string[]> = {
  'supino reto':         ['barbell bench press', 'bench press'],
  'supino inclinado':    ['incline bench press', 'incline barbell'],
  'supino declinado':    ['decline bench press'],
  'crucifixo máquina':   ['cable crossover', 'cable fly', 'pec deck'],
  'crucifixo':           ['dumbbell fly', 'cable fly'],
  'desenvolvimento':     ['overhead press', 'shoulder press', 'dumbbell shoulder press'],
  'tríceps corda':       ['tricep pushdown', 'cable tricep'],
  'tríceps testa':       ['skull crusher', 'lying tricep'],
  'tríceps pulley':      ['tricep pushdown', 'overhead tricep'],
  'puxada frente':       ['lat pulldown', 'cable lat'],
  'puxada atrás':        ['behind neck pulldown'],
  'remada curvada':      ['bent over row', 'barbell row'],
  'remada unilateral':   ['single arm row', 'dumbbell row'],
  'remada cavalinho':    ['t-bar row', 'cable row'],
  'rosca direta':        ['barbell curl', 'ez-bar curl'],
  'rosca martelo':       ['hammer curl'],
  'rosca scott':         ['preacher curl'],
  'agachamento':         ['barbell squat', 'squat'],
  'leg press':           ['leg press'],
  'cadeira extensora':   ['leg extension'],
  'mesa flexora':        ['leg curl', 'lying leg curl'],
  'panturrilha em pé':   ['standing calf', 'calf raise'],
  'panturrilha sentado': ['seated calf raise'],
  'stiff':               ['romanian deadlift', 'rdl', 'stiff'],
  'terra':               ['deadlift'],
  'afundo':              ['lunge'],
  'elevação lateral':    ['lateral raise'],
  'puxada neutra':       ['neutral grip pulldown'],
  'abdominal':           ['crunch', 'sit-up', 'ab'],
  'prancha':             ['plank'],
  'flexão':              ['push-up'],
};

// ── EN → PT label translations ────────────────────────────────────────────────

const TARGET_PT: Record<string, string> = {
  'quads':               'quadríceps',
  'glutes':              'glúteos',
  'hamstrings':          'posteriores',
  'calves':              'panturrilhas',
  'abductors':           'abdutores',
  'adductors':           'adutores',
  'upper back':          'costas superiores',
  'lats':                'latíssimo',
  'traps':               'trapézio',
  'delts':               'deltoides',
  'pectorals':           'peitoral',
  'biceps':              'bíceps',
  'triceps':             'tríceps',
  'abs':                 'abdômen',
  'spine':               'coluna',
  'cardiovascular system': 'cardio',
  'serratus anterior':   'serrátil',
  'levator scapulae':    'elevador da escápula',
};

const EQUIPMENT_PT: Record<string, string> = {
  'barbell':          'barra',
  'dumbbell':         'halter',
  'cable':            'cabo / polia',
  'machine':          'máquina',
  'body weight':      'peso corporal',
  'band':             'elástico',
  'kettlebell':       'kettlebell',
  'ez barbell':       'barra EZ',
  'smith machine':    'Smith',
  'leverage machine': 'máquina articulada',
  'medicine ball':    'medicine ball',
  'roller':           'rolo',
  'rope':             'corda',
  'stability ball':   'bola suíça',
  'tire':             'pneu',
  'trap bar':         'barra hexagonal',
  'weighted':         'com carga',
  'assisted':         'assistido',
  'resistance band':  'elástico',
  'other':            '',
};

function translateTarget(value: string): string {
  return TARGET_PT[value.toLowerCase()] ?? value;
}

function translateEquipment(value: string): string {
  return EQUIPMENT_PT[value.toLowerCase()] ?? value;
}

// ── Normalizer helpers ────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function findBestMatch(ptName: string, apiExercises: Exercise[]): Exercise | null {
  const normalizedPt = normalize(ptName);

  // 1. Try keyword lookup in our dictionary
  for (const [ptKey, enKeywords] of Object.entries(PT_TO_EN_KEYWORDS)) {
    if (!normalizedPt.includes(normalize(ptKey))) continue;
    for (const kw of enKeywords) {
      const match = apiExercises.find(e => normalize(e.name).includes(normalize(kw)));
      if (match) return match;
    }
  }

  // 2. Partial English word match on normalized PT name fragments
  const words = normalizedPt.split(/\s+/).filter(w => w.length > 3);
  for (const word of words) {
    const match = apiExercises.find(e => normalize(e.name).includes(word));
    if (match) return match;
  }

  return null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private auth = inject(AuthService);

  // In-memory cache: bodyPart → { exercises, expiresAt }
  private readonly _cache = new Map<string, { exercises: Exercise[]; expiresAt: number }>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 min client-side

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Fetch exercises from the backend for a given ExerciseDB bodyPart. */
  async getByBodyPart(bodyPart: string): Promise<Exercise[]> {
    const cached = this._cache.get(bodyPart);
    if (cached && cached.expiresAt > Date.now()) return cached.exercises;

    try {
      const res = await this._fetch(`/api/exercises/bodyPart/${encodeURIComponent(bodyPart)}`);
      if (!res.ok) return [];
      const data = await res.json();
      const exercises: Exercise[] = (data.exercises ?? []).map(this._normalize);
      this._cache.set(bodyPart, { exercises, expiresAt: Date.now() + this.CACHE_TTL });
      return exercises;
    } catch {
      return [];
    }
  }

  /**
   * Fetch exercises for a given PPL workout type (push / pull / legs).
   * Returns 5–8 exercises ready for rendering.
   */
  async getWorkoutExercises(workoutType: WorkoutType): Promise<Exercise[]> {
    try {
      const res = await this._fetch(`/api/exercises/workoutType/${workoutType}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.exercises ?? []).map(this._normalize);
    } catch {
      return [];
    }
  }

  /**
   * Given a workout plan's muscleGroup and its exercise list,
   * returns a Map<exerciseId, ExerciseMatch> matching each plan exercise
   * to the most relevant GIF from the API, including target and equipment.
   */
  async getGifsForPlan(
    muscleGroup: string,
    planExercises: Array<{ id: string; name: string }>,
  ): Promise<Map<string, ExerciseMatch>> {
    const bodyParts = MUSCLE_TO_BODY_PARTS[muscleGroup.toLowerCase()] ?? ['chest'];

    const lists = await Promise.all(bodyParts.map(bp => this.getByBodyPart(bp)));
    const allExercises = lists.flat();

    const resultMap = new Map<string, ExerciseMatch>();
    const used = new Set<string>();

    for (const planEx of planExercises) {
      const available = allExercises.filter(e => !used.has(e.id));
      const match = findBestMatch(planEx.name, available) ?? available[resultMap.size % available.length];
      if (match) {
        resultMap.set(planEx.id, {
          gif:       match.gifUrl,
          target:    translateTarget(match.target),
          equipment: translateEquipment(match.equipment),
        });
        used.add(match.id);
      }
    }

    return resultMap;
  }

  /**
   * Determine today's workout type (PPL rotation) based on last known session.
   * The caller can pass the last muscleGroup from workout history.
   */
  getTodayWorkoutType(lastMuscleGroup?: string): WorkoutType {
    const ROTATION: WorkoutType[] = ['push', 'pull', 'legs'];

    const PT_TO_TYPE: Record<string, WorkoutType> = {
      peito:  'push', ombros: 'push', triceps: 'push',
      costas: 'pull', biceps: 'pull',
      pernas: 'legs',
    };

    const last = lastMuscleGroup ? PT_TO_TYPE[lastMuscleGroup.toLowerCase()] : undefined;
    if (!last) return 'push'; // default start

    const idx = ROTATION.indexOf(last);
    return ROTATION[(idx + 1) % ROTATION.length];
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _normalize(raw: any): Exercise {
    return {
      id:          String(raw.id ?? ''),
      name:        String(raw.name ?? ''),
      muscleGroup: String(raw.bodyPart ?? ''),
      target:      String(raw.target ?? ''),
      equipment:   String(raw.equipment ?? ''),
      gifUrl:      String(raw.gifUrl ?? ''),
    };
  }

  private _fetch(path: string): Promise<Response> {
    return this.auth.apiFetch(path);
  }
}
