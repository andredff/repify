"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
const DEFAULT_YEARLY_GOAL = 320;
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
router.post('/complete', auth_middleware_1.requireAuth, async (req, res) => {
    const parsed = CompleteWorkoutSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' });
        return;
    }
    const userId = req.userId;
    const payload = parsed.data;
    const xp = xpForWorkout(payload.difficulty, payload.exercisesDone === payload.totalExercises);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const { data: existingStats, error: statsFetchError } = await supabase_1.supabaseAdmin
        .from('user_stats')
        .select('total_xp, weekly_xp, week_start, total_walk_km, streak_days')
        .eq('user_id', userId)
        .maybeSingle();
    if (statsFetchError) {
        console.error('[workouts] user_stats fetch error:', statsFetchError);
        res.status(500).json({ error: 'Failed to complete workout.' });
        return;
    }
    const weekRolled = existingStats && existingStats.week_start !== weekStartStr;
    const previousTotalXp = Number(existingStats?.total_xp ?? 0);
    const previousWeeklyXp = weekRolled ? 0 : Number(existingStats?.weekly_xp ?? 0);
    const totalWalkKm = Number(existingStats?.total_walk_km ?? 0);
    const streakDays = payload.streakDays ?? Number(existingStats?.streak_days ?? 0);
    const totalXp = previousTotalXp + xp;
    const weeklyXp = previousWeeklyXp + xp;
    const { error: upsertError } = await supabase_1.supabaseAdmin
        .from('user_stats')
        .upsert({
        user_id: userId,
        total_xp: totalXp,
        weekly_xp: weeklyXp,
        streak_days: streakDays,
        total_walk_km: totalWalkKm,
        week_start: weekStartStr,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (upsertError) {
        console.error('[workouts] user_stats upsert error:', upsertError);
        res.status(500).json({ error: 'Failed to complete workout.' });
        return;
    }
    const { error: xpInsertError } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .insert({ user_id: userId, type: 'workout', xp });
    if (xpInsertError) {
        console.error('[workouts] xp_events insert error:', xpInsertError);
        res.status(500).json({ error: 'Failed to complete workout.' });
        return;
    }
    const { count: workoutEventsCount, error: workoutCountError } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'workout');
    if (workoutCountError) {
        console.error('[workouts] xp_events count error:', workoutCountError);
        res.status(500).json({ error: 'Failed to complete workout.' });
        return;
    }
    const { data: existingUser, error: userFetchError } = await supabase_1.supabaseAdmin.auth.admin.getUserById(userId);
    if (userFetchError || !existingUser.user) {
        console.error('[workouts] auth user fetch error:', userFetchError);
        res.status(500).json({ error: 'Failed to complete workout.' });
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
            totalKm: totalWalkKm,
            xpEarned: xp,
        },
    });
});
exports.default = router;
