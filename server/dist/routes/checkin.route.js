"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
const CHECKIN_XP = 10;
// POST /api/checkin — registra check-in do dia (idempotente)
router.post('/', auth_middleware_1.requireAuth, async (req, res) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const userId = req.userId;
    const { data: existing, error: existingError } = await supabase_1.supabaseAdmin
        .from('checkins')
        .select('id, checked_at')
        .eq('user_id', userId)
        .eq('checked_at', today)
        .maybeSingle();
    if (existingError) {
        console.error('[checkin] existing lookup error:', existingError);
        res.status(500).json({ error: 'Failed to save check-in.' });
        return;
    }
    if (existing) {
        res.status(200).json({ checkin: existing, created: false });
        return;
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('checkins')
        .insert({ user_id: userId, checked_at: today })
        .select()
        .single();
    if (error) {
        console.error('[checkin] upsert error:', error);
        res.status(500).json({ error: 'Failed to save check-in.' });
        return;
    }
    const [{ data: checkinRows, error: streakError }, { data: existingStats, error: statsError }] = await Promise.all([
        supabase_1.supabaseAdmin
            .from('checkins')
            .select('checked_at')
            .eq('user_id', userId)
            .order('checked_at', { ascending: true }),
        supabase_1.supabaseAdmin
            .from('user_stats')
            .select('total_xp, weekly_xp, week_start, total_walk_km, streak_days')
            .eq('user_id', userId)
            .maybeSingle(),
    ]);
    if (streakError || statsError) {
        await supabase_1.supabaseAdmin.from('checkins').delete().eq('id', data.id);
        console.error('[checkin] metrics lookup error:', streakError ?? statsError);
        res.status(500).json({ error: 'Failed to update check-in metrics.' });
        return;
    }
    const dates = (checkinRows ?? []).map(row => row.checked_at).sort();
    const streakDays = calcStreak(dates);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekRolled = existingStats && existingStats.week_start !== weekStartStr;
    const previousTotalXp = Number(existingStats?.total_xp ?? 0);
    const previousWeeklyXp = weekRolled ? 0 : Number(existingStats?.weekly_xp ?? 0);
    const totalKm = Number(existingStats?.total_walk_km ?? 0);
    const totalXp = previousTotalXp + CHECKIN_XP;
    const weeklyXp = previousWeeklyXp + CHECKIN_XP;
    const { error: upsertError } = await supabase_1.supabaseAdmin
        .from('user_stats')
        .upsert({
        user_id: userId,
        total_xp: totalXp,
        weekly_xp: weeklyXp,
        streak_days: streakDays,
        total_walk_km: totalKm,
        week_start: weekStartStr,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (upsertError) {
        await supabase_1.supabaseAdmin.from('checkins').delete().eq('id', data.id);
        console.error('[checkin] user_stats upsert error:', upsertError);
        res.status(500).json({ error: 'Failed to update check-in metrics.' });
        return;
    }
    const { error: xpInsertError } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .insert({ user_id: userId, type: 'streak_bonus', xp: CHECKIN_XP });
    if (xpInsertError) {
        await supabase_1.supabaseAdmin.from('checkins').delete().eq('id', data.id);
        await supabase_1.supabaseAdmin.from('user_stats').upsert({
            user_id: userId,
            total_xp: previousTotalXp,
            weekly_xp: previousWeeklyXp,
            streak_days: Number(existingStats?.streak_days ?? 0),
            total_walk_km: totalKm,
            week_start: existingStats?.week_start ?? weekStartStr,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        console.error('[checkin] xp_events insert error:', xpInsertError);
        res.status(500).json({ error: 'Failed to update check-in metrics.' });
        return;
    }
    res.status(201).json({
        checkin: data,
        created: true,
        streakDays,
        xpAwarded: CHECKIN_XP,
        metrics: {
            totalXp,
            weeklyXp,
            totalKm,
            streakDays,
        },
    });
});
// GET /api/checkin?year=2026&month=4 — datas de check-in do mês
// GET /api/checkin?year=2026         — datas de check-in do ano
// GET /api/checkin                   — últimos 365 dias
router.get('/', auth_middleware_1.requireAuth, async (req, res) => {
    const year = req.query['year'] ? Number(req.query['year']) : null;
    const month = req.query['month'] ? Number(req.query['month']) : null;
    let from;
    let to;
    if (year && month) {
        const lastDay = new Date(year, month, 0).getDate();
        from = `${year}-${String(month).padStart(2, '0')}-01`;
        to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    else if (year) {
        from = `${year}-01-01`;
        to = `${year}-12-31`;
    }
    else {
        const d = new Date();
        to = d.toISOString().slice(0, 10);
        d.setFullYear(d.getFullYear() - 1);
        from = d.toISOString().slice(0, 10);
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('checkins')
        .select('id, checked_at')
        .eq('user_id', req.userId)
        .gte('checked_at', from)
        .lte('checked_at', to)
        .order('checked_at', { ascending: true });
    if (error) {
        res.status(500).json({ error: 'Failed to fetch check-ins.' });
        return;
    }
    // Streak atual
    const dates = (data ?? []).map(c => c.checked_at).sort();
    const streak = calcStreak(dates);
    res.json({ dates, streak, from, to });
});
// DELETE /api/checkin/today — desfaz check-in do dia
router.delete('/today', auth_middleware_1.requireAuth, async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const userId = req.userId;
    const { data: existingCheckin, error: lookupError } = await supabase_1.supabaseAdmin
        .from('checkins')
        .select('id')
        .eq('user_id', userId)
        .eq('checked_at', today)
        .maybeSingle();
    if (lookupError) {
        res.status(500).json({ error: 'Failed to delete check-in.' });
        return;
    }
    if (!existingCheckin) {
        res.status(204).send();
        return;
    }
    const { error } = await supabase_1.supabaseAdmin
        .from('checkins')
        .delete()
        .eq('user_id', userId)
        .eq('checked_at', today);
    if (error) {
        res.status(500).json({ error: 'Failed to delete check-in.' });
        return;
    }
    const [{ data: checkinRows, error: streakError }, { data: existingStats, error: statsError }] = await Promise.all([
        supabase_1.supabaseAdmin
            .from('checkins')
            .select('checked_at')
            .eq('user_id', userId)
            .order('checked_at', { ascending: true }),
        supabase_1.supabaseAdmin
            .from('user_stats')
            .select('total_xp, weekly_xp, week_start, total_walk_km')
            .eq('user_id', userId)
            .maybeSingle(),
    ]);
    if (streakError || statsError) {
        console.error('[checkin] undo metrics lookup error:', streakError ?? statsError);
        res.status(500).json({ error: 'Failed to update check-in metrics.' });
        return;
    }
    const dates = (checkinRows ?? []).map(row => row.checked_at).sort();
    const streakDays = calcStreak(dates);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekRolled = existingStats && existingStats.week_start !== weekStartStr;
    const previousTotalXp = Number(existingStats?.total_xp ?? 0);
    const previousWeeklyXp = weekRolled ? 0 : Number(existingStats?.weekly_xp ?? 0);
    const totalKm = Number(existingStats?.total_walk_km ?? 0);
    const totalXp = Math.max(previousTotalXp - CHECKIN_XP, 0);
    const weeklyXp = Math.max(previousWeeklyXp - CHECKIN_XP, 0);
    const { error: upsertError } = await supabase_1.supabaseAdmin
        .from('user_stats')
        .upsert({
        user_id: userId,
        total_xp: totalXp,
        weekly_xp: weeklyXp,
        streak_days: streakDays,
        total_walk_km: totalKm,
        week_start: existingStats?.week_start ?? weekStartStr,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (upsertError) {
        console.error('[checkin] undo user_stats upsert error:', upsertError);
        res.status(500).json({ error: 'Failed to update check-in metrics.' });
        return;
    }
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;
    const { data: xpEvent } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'streak_bonus')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .order('created_at', { ascending: false })
        .maybeSingle();
    if (xpEvent?.id) {
        await supabase_1.supabaseAdmin.from('xp_events').delete().eq('id', xpEvent.id);
    }
    res.json({
        ok: true,
        metrics: {
            totalXp,
            weeklyXp,
            totalKm,
            streakDays,
        },
    });
});
function calcStreak(sortedDates) {
    if (!sortedDates.length)
        return 0;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const last = sortedDates[sortedDates.length - 1];
    // Streak só conta se o último check-in foi hoje ou ontem
    if (last !== today && last !== yesterday)
        return 0;
    let streak = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
        const curr = new Date(sortedDates[i + 1]);
        const prev = new Date(sortedDates[i]);
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        if (diff === 1)
            streak++;
        else
            break;
    }
    return streak;
}
exports.default = router;
