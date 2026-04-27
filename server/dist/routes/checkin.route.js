"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
// POST /api/checkin — registra check-in do dia (idempotente)
router.post('/', auth_middleware_1.requireAuth, async (req, res) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data: existing, error: existingError } = await supabase_1.supabaseAdmin
        .from('checkins')
        .select('id, checked_at')
        .eq('user_id', req.userId)
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
        .insert({ user_id: req.userId, checked_at: today })
        .select()
        .single();
    if (error) {
        console.error('[checkin] upsert error:', error);
        res.status(500).json({ error: 'Failed to save check-in.' });
        return;
    }
    res.status(201).json({ checkin: data, created: true });
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
    const { error } = await supabase_1.supabaseAdmin
        .from('checkins')
        .delete()
        .eq('user_id', req.userId)
        .eq('checked_at', today);
    if (error) {
        res.status(500).json({ error: 'Failed to delete check-in.' });
        return;
    }
    res.status(204).send();
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
