import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();
const DEFAULT_YEARLY_GOAL = 320;

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

router.post('/complete', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = CompleteWorkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' });
    return;
  }

  const userId = req.userId!;
  const payload = parsed.data;
  const xp = xpForWorkout(payload.difficulty, payload.exercisesDone === payload.totalExercises);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const { data: existingStats, error: statsFetchError } = await supabaseAdmin
    .from('user_stats')
    .select('total_xp, weekly_xp, week_start, streak_days')
    .eq('user_id', userId)
    .maybeSingle();

  if (statsFetchError) {
    console.error('[workouts] user_stats fetch error:', statsFetchError);
    sendStageError(res, 'user_stats fetch', statsFetchError);
    return;
  }

  const weekRolled = existingStats && existingStats.week_start !== weekStartStr;
  const previousTotalXp = Number(existingStats?.total_xp ?? 0);
  const previousWeeklyXp = weekRolled ? 0 : Number(existingStats?.weekly_xp ?? 0);
  const streakDays = payload.streakDays ?? Number(existingStats?.streak_days ?? 0);
  const totalXp = previousTotalXp + xp;
  const weeklyXp = previousWeeklyXp + xp;

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
    console.error('[workouts] user_stats upsert error:', upsertError);
    sendStageError(res, 'user_stats upsert', upsertError);
    return;
  }

  const { error: xpInsertError } = await supabaseAdmin
    .from('xp_events')
    .insert({ user_id: userId, type: 'workout', xp });

  if (xpInsertError) {
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
  const yearlyGoal = Number(meta['yearly_goal'] ?? DEFAULT_YEARLY_GOAL) || DEFAULT_YEARLY_GOAL;

  const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...meta,
      yearly_goal: yearlyGoal,
      workouts_done: workoutsDone,
    },
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
      yearlyGoal,
      streakDays,
      xpEarned: xp,
    },
  });
});

export default router;
