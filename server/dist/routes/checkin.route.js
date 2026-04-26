"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
const CheckInSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    gym_name: zod_1.z.string().max(120).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
// POST /api/checkin — register a GPS check-in
router.post('/', auth_middleware_1.requireAuth, async (req, res) => {
    const parsed = CheckInSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
        return;
    }
    const { latitude, longitude, gym_name, notes } = parsed.data;
    const { data, error } = await supabase_1.supabaseAdmin
        .from('checkins')
        .insert({
        user_id: req.userId,
        latitude,
        longitude,
        gym_name: gym_name ?? null,
        notes: notes ?? null,
        checked_at: new Date().toISOString(),
    })
        .select()
        .single();
    if (error) {
        console.error('[checkin] insert error:', error);
        res.status(500).json({ error: 'Failed to save check-in.' });
        return;
    }
    res.status(201).json({ checkin: data });
});
// GET /api/checkin — list user's check-ins (most recent first)
router.get('/', auth_middleware_1.requireAuth, async (req, res) => {
    const limit = Math.min(Number(req.query['limit']) || 20, 100);
    const offset = Math.max(Number(req.query['offset']) || 0, 0);
    const { data, error } = await supabase_1.supabaseAdmin
        .from('checkins')
        .select('*')
        .eq('user_id', req.userId)
        .order('checked_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        res.status(500).json({ error: 'Failed to fetch check-ins.' });
        return;
    }
    res.json({ checkins: data, limit, offset });
});
exports.default = router;
