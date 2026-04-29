import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const StoredExerciseSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  sets: z.number().int().min(1).max(50),
  reps: z.string().min(1).max(80),
  done: z.boolean(),
});

const StoredPlanSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  muscleGroup: z.string().min(1).max(80),
  exercises: z.array(StoredExerciseSchema).max(100),
  estimatedDuration: z.number().int().min(1).max(600),
  totalExercises: z.number().int().min(1).max(100),
  difficulty: z.enum(['Iniciante', 'Intermediário', 'Avançado']),
  dayLabel: z.string().min(1).max(80),
  dayIndex: z.number().int().min(0).max(6),
});

const ActiveProgramSchema = z.object({
  goal: z.string().min(1).max(80),
  level: z.string().min(1).max(80),
  days: z.number().int().min(1).max(7),
  plans: z.array(StoredPlanSchema).max(7),
  createdAt: z.string().datetime(),
});

const StartWorkoutSessionSchema = z.object({
  planId: z.string().min(1).max(120),
});

const CompleteWorkoutSchema = z.object({
  planId: z.string().min(1).max(120),
  planName: z.string().min(1).max(120),
  muscleGroup: z.string().min(1).max(40),
  difficulty: z.enum(['Iniciante', 'Intermediário', 'Avançado']),
  estimatedDuration: z.number().int().min(1).max(600),
  totalExercises: z.number().int().min(1).max(100),
  exercisesDone: z.number().int().min(0).max(100),
  streakDays: z.number().int().min(0).max(999).optional(),
});

interface WorkoutProgramRow {
  goal: string;
  level: string;
  days: number;
  plans: unknown;
  created_at: string;
}

interface WorkoutDaySessionRow {
  user_id: string;
  session_date: string;
  active_plan_id: string | null;
  started_at: string | null;
  completed_plan_id: string | null;
  completed_at: string | null;
  motivational_quote: string | null;
}

interface WorkoutHistoryRow {
  id: string;
  plan_id: string;
  plan_name: string;
  muscle_group: string;
  difficulty: string;
  completed_at: string;
  completed_date: string;
  exercises_done: number;
  total_exercises: number;
  estimated_duration: number;
  xp_earned: number;
}

function isoToMillis(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function isDuplicateDailyWorkoutHistoryError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message ?? '';
  return message.includes('workout_history_user_completed_date_idx') || message.includes('duplicate key value');
}

function xpForWorkout(difficulty: 'Iniciante' | 'Intermediário' | 'Avançado', allDone: boolean): number {
  const base = 50;
  const diffBonus = { Iniciante: 0, Intermediário: 20, Avançado: 40 };
  return base + diffBonus[difficulty] + (allDone ? 30 : 0);
}

function sendStageError(res: Response, stage: string, error: { message?: string } | null | undefined): void {
  res.status(500).json({
    error: `Workout completion failed at ${stage}.`,
    details: error?.message ?? 'Unknown server error.',
  });
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

function todayDateString(): string {
  return formatBusinessDate(new Date());
}

function emptyDaySession(date: string): WorkoutDaySessionRow {
  return {
    user_id: '',
    session_date: date,
    active_plan_id: null,
    started_at: null,
    completed_plan_id: null,
    completed_at: null,
    motivational_quote: null,
  };
}

function mapDaySession(row: WorkoutDaySessionRow | null | undefined, date: string): WorkoutDaySessionRow {
  return row ?? emptyDaySession(date);
}

router.get('/state', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const today = todayDateString();

  const [programResult, daySessionResult, historyResult] = await Promise.all([
    supabaseAdmin
      .from('workout_programs')
      .select('goal,level,days,plans,created_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('workout_day_sessions')
      .select('user_id,session_date,active_plan_id,started_at,completed_plan_id,completed_at,motivational_quote')
      .eq('user_id', userId)
      .eq('session_date', today)
      .maybeSingle(),
    supabaseAdmin
      .from('workout_history')
      .select('id,plan_id,plan_name,muscle_group,difficulty,completed_at,completed_date,exercises_done,total_exercises,estimated_duration,xp_earned')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false }),
  ]);

  if (programResult.error) {
    res.status(500).json({ error: 'Failed to load workout program.', details: programResult.error.message });
    return;
  }

  if (daySessionResult.error) {
    res.status(500).json({ error: 'Failed to load workout day session.', details: daySessionResult.error.message });
    return;
  }

  if (historyResult.error) {
    res.status(500).json({ error: 'Failed to load workout history.', details: historyResult.error.message });
    return;
  }

  const programRow = programResult.data as WorkoutProgramRow | null;
  const historyRows = (historyResult.data ?? []) as WorkoutHistoryRow[];
  const totalXp = historyRows.reduce((sum, row) => sum + Number(row.xp_earned ?? 0), 0);

  res.json({
    program: programRow
      ? {
          goal: programRow.goal,
          level: programRow.level,
          days: programRow.days,
          plans: Array.isArray(programRow.plans) ? programRow.plans : [],
          createdAt: programRow.created_at,
        }
      : null,
    daySession: mapDaySession(daySessionResult.data as WorkoutDaySessionRow | null, today),
    history: historyRows.map(row => ({
      id: row.id,
      planId: row.plan_id,
      planName: row.plan_name,
      muscleGroup: row.muscle_group,
      difficulty: row.difficulty,
      completedAt: row.completed_at,
      completedDate: row.completed_date,
      dateLabel: '',
      exercisesDone: row.exercises_done,
      totalExercises: row.total_exercises,
      estimatedDuration: row.estimated_duration,
      xpEarned: row.xp_earned,
    })),
    totalXp,
  });
});

router.put('/program', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = ActiveProgramSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid program payload.' });
    return;
  }

  const userId = req.userId!;
  const payload = parsed.data;

  const { error } = await supabaseAdmin
    .from('workout_programs')
    .upsert({
      user_id: userId,
      goal: payload.goal,
      level: payload.level,
      days: payload.days,
      plans: payload.plans,
      created_at: payload.createdAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    res.status(500).json({ error: 'Failed to save workout program.', details: error.message });
    return;
  }

  res.json({ ok: true });
});

router.delete('/program', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { error } = await supabaseAdmin.from('workout_programs').delete().eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: 'Failed to clear workout program.', details: error.message });
    return;
  }

  res.json({ ok: true });
});

router.post('/session/start', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = StartWorkoutSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid workout session payload.' });
    return;
  }

  const userId = req.userId!;
  const today = todayDateString();
  const nowIso = new Date().toISOString();

  const [existingResult, programResult] = await Promise.all([
    supabaseAdmin
    .from('workout_day_sessions')
    .select('user_id,session_date,active_plan_id,started_at,completed_plan_id,completed_at,motivational_quote')
    .eq('user_id', userId)
    .eq('session_date', today)
    .maybeSingle(),
    supabaseAdmin
      .from('workout_programs')
      .select('created_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (existingResult.error) {
    res.status(500).json({ error: 'Failed to read workout session.', details: existingResult.error.message });
    return;
  }

  if (programResult.error) {
    res.status(500).json({ error: 'Failed to read workout program.', details: programResult.error.message });
    return;
  }

  const existing = existingResult.data as WorkoutDaySessionRow | null;
  const currentProgram = programResult.data as { created_at?: string | null } | null;
  const programCreatedAtMs = isoToMillis(currentProgram?.created_at ?? null);
  const completedAtMs = isoToMillis(existing?.completed_at ?? null);
  const completedAfterCurrentProgram = completedAtMs != null && programCreatedAtMs != null
    ? completedAtMs >= programCreatedAtMs
    : !!existing?.completed_at;

  const isSwitchingPlan = existing?.active_plan_id != null && existing.active_plan_id !== parsed.data.planId;

  const nextSession = {
    user_id: userId,
    session_date: today,
    active_plan_id: parsed.data.planId,
    started_at: isSwitchingPlan ? nowIso : (existing?.started_at ?? nowIso),
    completed_plan_id: completedAfterCurrentProgram ? existing?.completed_plan_id ?? null : null,
    completed_at: completedAfterCurrentProgram ? existing?.completed_at ?? null : null,
    motivational_quote: completedAfterCurrentProgram ? existing?.motivational_quote ?? null : null,
  };

  const { data, error } = await supabaseAdmin
    .from('workout_day_sessions')
    .upsert(nextSession, { onConflict: 'user_id,session_date' })
    .select('user_id,session_date,active_plan_id,started_at,completed_plan_id,completed_at,motivational_quote')
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to start workout session.', details: error.message });
    return;
  }

  res.json({ ok: true, daySession: data });
});

router.post('/complete', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = CompleteWorkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' });
    return;
  }

  const userId = req.userId!;
  const payload = parsed.data;
  const today = todayDateString();
  const completedAt = new Date().toISOString();
  const xp = xpForWorkout(payload.difficulty, payload.exercisesDone === payload.totalExercises);
  const motivationalQuote = 'Disciplina e fazer mesmo sem vontade.';

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [existingStatsResult, rewardedWorkoutResult, existingDaySessionResult] = await Promise.all([
    supabaseAdmin
      .from('user_stats')
      .select('total_xp, weekly_xp, week_start, streak_days')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('workout_history')
      .select('id,xp_earned')
      .eq('user_id', userId)
      .eq('completed_date', today)
      .gt('xp_earned', 0)
      .maybeSingle(),
    supabaseAdmin
      .from('workout_day_sessions')
      .select('user_id,session_date,active_plan_id,started_at,completed_plan_id,completed_at,motivational_quote')
      .eq('user_id', userId)
      .eq('session_date', today)
      .maybeSingle(),
  ]);

  if (existingStatsResult.error) {
    console.error('[workouts] user_stats fetch error:', existingStatsResult.error);
    sendStageError(res, 'user_stats fetch', existingStatsResult.error);
    return;
  }

  if (rewardedWorkoutResult.error) {
    console.error('[workouts] workout_history fetch error:', rewardedWorkoutResult.error);
    sendStageError(res, 'workout_history fetch', rewardedWorkoutResult.error);
    return;
  }

  if (existingDaySessionResult.error) {
    console.error('[workouts] workout_day_sessions fetch error:', existingDaySessionResult.error);
    sendStageError(res, 'workout_day_sessions fetch', existingDaySessionResult.error);
    return;
  }

  const existingStats = existingStatsResult.data;
  const existingDaySession = existingDaySessionResult.data as WorkoutDaySessionRow | null;
  const rewardedWorkoutToday = !!rewardedWorkoutResult.data?.id;
  const weekRolled = existingStats && existingStats.week_start !== weekStartStr;
  const previousTotalXp = Number(existingStats?.total_xp ?? 0);
  const previousWeeklyXp = weekRolled ? 0 : Number(existingStats?.weekly_xp ?? 0);
  const previousStreakDays = Number(existingStats?.streak_days ?? 0);
  const streakDays = payload.streakDays ?? previousStreakDays;
  const earnedXp = rewardedWorkoutToday ? 0 : xp;
  const totalXp = previousTotalXp + earnedXp;
  const weeklyXp = previousWeeklyXp + earnedXp;

  const historyInsertResult = await supabaseAdmin
    .from('workout_history')
    .insert({
      user_id: userId,
      plan_id: payload.planId,
      plan_name: payload.planName,
      muscle_group: payload.muscleGroup,
      difficulty: payload.difficulty,
      completed_at: completedAt,
      completed_date: today,
      exercises_done: payload.exercisesDone,
      total_exercises: payload.totalExercises,
      estimated_duration: payload.estimatedDuration,
      xp_earned: earnedXp,
    })
    .select('id')
    .single();

  const canSkipHistoryInsert = earnedXp === 0 && isDuplicateDailyWorkoutHistoryError(historyInsertResult.error);
  if (historyInsertResult.error && !canSkipHistoryInsert) {
    console.error('[workouts] workout_history insert error:', historyInsertResult.error);
    sendStageError(res, 'workout_history insert', historyInsertResult.error);
    return;
  }

  const insertedHistoryId = historyInsertResult.data?.id as string | undefined;
  const completedDaySession = {
    user_id: userId,
    session_date: today,
    active_plan_id: payload.planId,
    started_at: existingDaySession?.started_at ?? completedAt,
    completed_plan_id: payload.planId,
    completed_at: completedAt,
    motivational_quote: existingDaySession?.motivational_quote ?? motivationalQuote,
  };

  const { error: daySessionUpsertError } = await supabaseAdmin
    .from('workout_day_sessions')
    .upsert(completedDaySession, { onConflict: 'user_id,session_date' });

  if (daySessionUpsertError) {
    if (insertedHistoryId) {
      await supabaseAdmin.from('workout_history').delete().eq('id', insertedHistoryId);
    }
    console.error('[workouts] workout_day_sessions upsert error:', daySessionUpsertError);
    sendStageError(res, 'workout_day_sessions upsert', daySessionUpsertError);
    return;
  }

  const { error: upsertError } = await supabaseAdmin
    .from('user_stats')
    .upsert({
      user_id: userId,
      total_xp: totalXp,
      weekly_xp: weeklyXp,
      streak_days: streakDays,
      week_start: weekStartStr,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (upsertError) {
    if (insertedHistoryId) {
      await supabaseAdmin.from('workout_history').delete().eq('id', insertedHistoryId);
    }
    if (existingDaySession) {
      await supabaseAdmin.from('workout_day_sessions').upsert(existingDaySession, { onConflict: 'user_id,session_date' });
    } else {
      await supabaseAdmin.from('workout_day_sessions').delete().eq('user_id', userId).eq('session_date', today);
    }
    console.error('[workouts] user_stats upsert error:', upsertError);
    sendStageError(res, 'user_stats upsert', upsertError);
    return;
  }

  const xpInsertError = earnedXp > 0
    ? (await supabaseAdmin
      .from('xp_events')
      .insert({ user_id: userId, type: 'workout', xp: earnedXp })).error
    : null;

  if (earnedXp === 0) {
    const { data: existingUser, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userFetchError || !existingUser.user) {
      console.error('[workouts] auth user fetch error:', userFetchError);
      sendStageError(res, 'auth user fetch', userFetchError);
      return;
    }

    const workoutsDone = Number(existingUser.user.user_metadata?.['workouts_done'] ?? 0);

    res.json({
      ok: true,
      metrics: {
        totalXp,
        weeklyXp,
        workoutsDone,
        streakDays,
        xpEarned: earnedXp,
      },
      daySession: completedDaySession,
    });
    return;
  }

  if (xpInsertError) {
    if (insertedHistoryId) {
      await supabaseAdmin.from('workout_history').delete().eq('id', insertedHistoryId);
    }
    if (existingDaySession) {
      await supabaseAdmin.from('workout_day_sessions').upsert(existingDaySession, { onConflict: 'user_id,session_date' });
    } else {
      await supabaseAdmin.from('workout_day_sessions').delete().eq('user_id', userId).eq('session_date', today);
    }
    await supabaseAdmin.from('user_stats').upsert({
      user_id: userId,
      total_xp: previousTotalXp,
      weekly_xp: previousWeeklyXp,
      streak_days: previousStreakDays,
      week_start: existingStats?.week_start ?? weekStartStr,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    console.error('[workouts] xp_events insert error:', xpInsertError);
    sendStageError(res, 'xp_events insert', xpInsertError);
    return;
  }

  const { count: workoutEventsCount, error: workoutCountError } = await supabaseAdmin
    .from('xp_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'workout');

  if (workoutCountError) {
    console.error('[workouts] xp_events count error:', workoutCountError);
    sendStageError(res, 'xp_events count', workoutCountError);
    return;
  }

  const { data: existingUser, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userFetchError || !existingUser.user) {
    console.error('[workouts] auth user fetch error:', userFetchError);
    sendStageError(res, 'auth user fetch', userFetchError);
    return;
  }

  const meta = existingUser.user.user_metadata ?? {};
  const workoutsDone = Number(workoutEventsCount ?? 0);

  const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { ...meta, workouts_done: workoutsDone },
  });

  if (updateUserError) {
    console.error('[workouts] auth metadata update error:', updateUserError);
  }

  res.json({
    ok: true,
    metrics: {
      totalXp,
      weeklyXp,
      workoutsDone,
      streakDays,
      xpEarned: earnedXp,
    },
    daySession: completedDaySession,
  });
});

export default router;
