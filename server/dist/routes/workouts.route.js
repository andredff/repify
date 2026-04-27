"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
const DEFAULT_YEARLY_GOAL = 320;
const StoredExerciseSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(120),
    name: zod_1.z.string().min(1).max(160),
    sets: zod_1.z.number().int().min(1).max(50),
    reps: zod_1.z.string().min(1).max(80),
    done: zod_1.z.boolean(),
});
const StoredPlanSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(120),
    name: zod_1.z.string().min(1).max(160),
    muscleGroup: zod_1.z.string().min(1).max(80),
    exercises: zod_1.z.array(StoredExerciseSchema).max(100),
    estimatedDuration: zod_1.z.number().int().min(1).max(600),
    totalExercises: zod_1.z.number().int().min(1).max(100),
    difficulty: zod_1.z.enum(['Iniciante', 'Intermediário', 'Avançado']),
    dayLabel: zod_1.z.string().min(1).max(80),
    dayIndex: zod_1.z.number().int().min(0).max(6),
});
const ActiveProgramSchema = zod_1.z.object({
    goal: zod_1.z.string().min(1).max(80),
    level: zod_1.z.string().min(1).max(80),
    days: zod_1.z.number().int().min(1).max(7),
    plans: zod_1.z.array(StoredPlanSchema).max(7),
    createdAt: zod_1.z.string().datetime(),
});
const StartWorkoutSessionSchema = zod_1.z.object({
    planId: zod_1.z.string().min(1).max(120),
});
const CompleteWorkoutSchema = zod_1.z.object({
    planId: zod_1.z.string().min(1).max(120),
    planName: zod_1.z.string().min(1).max(120),
    muscleGroup: zod_1.z.string().min(1).max(40),
    difficulty: zod_1.z.enum(['Iniciante', 'Intermediário', 'Avançado']),
    estimatedDuration: zod_1.z.number().int().min(1).max(600),
    totalExercises: zod_1.z.number().int().min(1).max(100),
    exercisesDone: zod_1.z.number().int().min(0).max(100),
    streakDays: zod_1.z.number().int().min(0).max(999).optional(),
});
function xpForWorkout(difficulty, allDone) {
    const base = 50;
    const diffBonus = { Iniciante: 0, Intermediário: 20, Avançado: 40 };
    return base + diffBonus[difficulty] + (allDone ? 30 : 0);
}
function sendStageError(res, stage, error) {
    res.status(500).json({
        error: `Workout completion failed at ${stage}.`,
        details: error?.message ?? 'Unknown server error.',
    });
}
function todayDateString() {
    return new Date().toISOString().slice(0, 10);
}
function emptyDaySession(date) {
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
function mapDaySession(row, date) {
    return row ?? emptyDaySession(date);
}
router.get('/state', auth_middleware_1.requireAuth, async (req, res) => {
    const userId = req.userId;
    const today = todayDateString();
    const [programResult, daySessionResult, historyResult] = await Promise.all([
        supabase_1.supabaseAdmin
            .from('workout_programs')
            .select('goal,level,days,plans,created_at')
            .eq('user_id', userId)
            .maybeSingle(),
        supabase_1.supabaseAdmin
            .from('workout_day_sessions')
            .select('user_id,session_date,active_plan_id,started_at,completed_plan_id,completed_at,motivational_quote')
            .eq('user_id', userId)
            .eq('session_date', today)
            .maybeSingle(),
        supabase_1.supabaseAdmin
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
    const programRow = programResult.data;
    const historyRows = (historyResult.data ?? []);
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
        daySession: mapDaySession(daySessionResult.data, today),
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
router.put('/program', auth_middleware_1.requireAuth, async (req, res) => {
    const parsed = ActiveProgramSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid program payload.' });
        return;
    }
    const userId = req.userId;
    const payload = parsed.data;
    const { error } = await supabase_1.supabaseAdmin
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
router.delete('/program', auth_middleware_1.requireAuth, async (req, res) => {
    const userId = req.userId;
    const { error } = await supabase_1.supabaseAdmin.from('workout_programs').delete().eq('user_id', userId);
    if (error) {
        res.status(500).json({ error: 'Failed to clear workout program.', details: error.message });
        return;
    }
    res.json({ ok: true });
});
router.post('/session/start', auth_middleware_1.requireAuth, async (req, res) => {
    const parsed = StartWorkoutSessionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid workout session payload.' });
        return;
    }
    const userId = req.userId;
    const today = todayDateString();
    const nowIso = new Date().toISOString();
    const existingResult = await supabase_1.supabaseAdmin
        .from('workout_day_sessions')
        .select('user_id,session_date,active_plan_id,started_at,completed_plan_id,completed_at,motivational_quote')
        .eq('user_id', userId)
        .eq('session_date', today)
        .maybeSingle();
    if (existingResult.error) {
        res.status(500).json({ error: 'Failed to read workout session.', details: existingResult.error.message });
        return;
    }
    const existing = existingResult.data;
    if (existing?.completed_at) {
        res.status(409).json({ error: 'Workout already completed today.', daySession: existing });
        return;
    }
    if (existing?.active_plan_id && existing.active_plan_id !== parsed.data.planId) {
        res.status(409).json({ error: 'Another workout is already active today.', daySession: existing });
        return;
    }
    const nextSession = {
        user_id: userId,
        session_date: today,
        active_plan_id: parsed.data.planId,
        started_at: existing?.started_at ?? nowIso,
        completed_plan_id: existing?.completed_plan_id ?? null,
        completed_at: existing?.completed_at ?? null,
        motivational_quote: existing?.motivational_quote ?? null,
    };
    const { data, error } = await supabase_1.supabaseAdmin
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
router.post('/complete', auth_middleware_1.requireAuth, async (req, res) => {
    const parsed = CompleteWorkoutSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' });
        return;
    }
    const userId = req.userId;
    const payload = parsed.data;
    const today = todayDateString();
    const completedAt = new Date().toISOString();
    const xp = xpForWorkout(payload.difficulty, payload.exercisesDone === payload.totalExercises);
    const motivationalQuote = 'Disciplina e fazer mesmo sem vontade.';
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const [existingStatsResult, existingHistoryResult, existingDaySessionResult] = await Promise.all([
        supabase_1.supabaseAdmin
            .from('user_stats')
            .select('total_xp, weekly_xp, week_start, streak_days')
            .eq('user_id', userId)
            .maybeSingle(),
        supabase_1.supabaseAdmin
            .from('workout_history')
            .select('id')
            .eq('user_id', userId)
            .eq('completed_date', today)
            .maybeSingle(),
        supabase_1.supabaseAdmin
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
    if (existingHistoryResult.error) {
        console.error('[workouts] workout_history fetch error:', existingHistoryResult.error);
        sendStageError(res, 'workout_history fetch', existingHistoryResult.error);
        return;
    }
    if (existingDaySessionResult.error) {
        console.error('[workouts] workout_day_sessions fetch error:', existingDaySessionResult.error);
        sendStageError(res, 'workout_day_sessions fetch', existingDaySessionResult.error);
        return;
    }
    if (existingHistoryResult.data?.id) {
        res.status(409).json({ error: 'Workout already completed today.' });
        return;
    }
    const existingStats = existingStatsResult.data;
    const existingDaySession = existingDaySessionResult.data;
    const weekRolled = existingStats && existingStats.week_start !== weekStartStr;
    const previousTotalXp = Number(existingStats?.total_xp ?? 0);
    const previousWeeklyXp = weekRolled ? 0 : Number(existingStats?.weekly_xp ?? 0);
    const previousStreakDays = Number(existingStats?.streak_days ?? 0);
    const streakDays = payload.streakDays ?? previousStreakDays;
    const totalXp = previousTotalXp + xp;
    const weeklyXp = previousWeeklyXp + xp;
    const historyInsertResult = await supabase_1.supabaseAdmin
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
        xp_earned: xp,
    })
        .select('id')
        .single();
    if (historyInsertResult.error) {
        console.error('[workouts] workout_history insert error:', historyInsertResult.error);
        sendStageError(res, 'workout_history insert', historyInsertResult.error);
        return;
    }
    const insertedHistoryId = historyInsertResult.data.id;
    const completedDaySession = {
        user_id: userId,
        session_date: today,
        active_plan_id: payload.planId,
        started_at: existingDaySession?.started_at ?? completedAt,
        completed_plan_id: payload.planId,
        completed_at: completedAt,
        motivational_quote: existingDaySession?.motivational_quote ?? motivationalQuote,
    };
    const { error: daySessionUpsertError } = await supabase_1.supabaseAdmin
        .from('workout_day_sessions')
        .upsert(completedDaySession, { onConflict: 'user_id,session_date' });
    if (daySessionUpsertError) {
        await supabase_1.supabaseAdmin.from('workout_history').delete().eq('id', insertedHistoryId);
        console.error('[workouts] workout_day_sessions upsert error:', daySessionUpsertError);
        sendStageError(res, 'workout_day_sessions upsert', daySessionUpsertError);
        return;
    }
    const { error: upsertError } = await supabase_1.supabaseAdmin
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
        await supabase_1.supabaseAdmin.from('workout_history').delete().eq('id', insertedHistoryId);
        if (existingDaySession) {
            await supabase_1.supabaseAdmin.from('workout_day_sessions').upsert(existingDaySession, { onConflict: 'user_id,session_date' });
        }
        else {
            await supabase_1.supabaseAdmin.from('workout_day_sessions').delete().eq('user_id', userId).eq('session_date', today);
        }
        console.error('[workouts] user_stats upsert error:', upsertError);
        sendStageError(res, 'user_stats upsert', upsertError);
        return;
    }
    const { error: xpInsertError } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .insert({ user_id: userId, type: 'workout', xp });
    if (xpInsertError) {
        await supabase_1.supabaseAdmin.from('workout_history').delete().eq('id', insertedHistoryId);
        if (existingDaySession) {
            await supabase_1.supabaseAdmin.from('workout_day_sessions').upsert(existingDaySession, { onConflict: 'user_id,session_date' });
        }
        else {
            await supabase_1.supabaseAdmin.from('workout_day_sessions').delete().eq('user_id', userId).eq('session_date', today);
        }
        await supabase_1.supabaseAdmin.from('user_stats').upsert({
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
    const { count: workoutEventsCount, error: workoutCountError } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'workout');
    if (workoutCountError) {
        console.error('[workouts] xp_events count error:', workoutCountError);
        sendStageError(res, 'xp_events count', workoutCountError);
        return;
    }
    const { data: existingUser, error: userFetchError } = await supabase_1.supabaseAdmin.auth.admin.getUserById(userId);
    if (userFetchError || !existingUser.user) {
        console.error('[workouts] auth user fetch error:', userFetchError);
        sendStageError(res, 'auth user fetch', userFetchError);
        return;
    }
    const meta = existingUser.user.user_metadata ?? {};
    const workoutsDone = Number(workoutEventsCount ?? 0);
    const yearlyGoal = Number(meta['yearly_goal'] ?? DEFAULT_YEARLY_GOAL) || DEFAULT_YEARLY_GOAL;
    const { error: updateUserError } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(userId, {
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
        daySession: completedDaySession,
    });
});
exports.default = router;
