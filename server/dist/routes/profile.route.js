"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
const ProfileSchema = zod_1.z.object({
    full_name: zod_1.z.string().max(60).optional(),
    username: zod_1.z.string().max(30).regex(/^[a-z0-9_.]*$/).optional(),
    bio: zod_1.z.string().max(500).optional(),
    weight: zod_1.z.number().min(20).max(400).nullable().optional(),
    height: zod_1.z.number().min(50).max(300).nullable().optional(),
    goal: zod_1.z.string().max(50).optional(),
    yearly_goal: zod_1.z.number().int().min(1).max(999).nullable().optional(),
});
// GET /api/profile/me
router.get('/me', auth_middleware_1.requireAuth, async (req, res) => {
    const { data, error } = await supabase_1.supabaseAdmin.auth.admin.getUserById(req.userId);
    if (error || !data.user) {
        res.status(404).json({ error: 'User not found.' });
        return;
    }
    const { count: workoutsDone, error: workoutCountError } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId)
        .eq('type', 'workout');
    if (workoutCountError) {
        console.error('[profile] xp_events count error:', workoutCountError);
        res.status(500).json({ error: 'Failed to load profile.' });
        return;
    }
    const meta = data.user.user_metadata ?? {};
    res.json({
        id: data.user.id,
        email: data.user.email,
        full_name: meta['full_name'] ?? '',
        username: meta['username'] ?? '',
        bio: meta['bio'] ?? '',
        weight: meta['weight'] ?? null,
        height: meta['height'] ?? null,
        goal: meta['goal'] ?? '',
        avatar_url: meta['avatar_url'] ?? '',
        yearly_goal: meta['yearly_goal'] ?? null,
        workouts_done: Number(workoutsDone ?? meta['workouts_done'] ?? 0),
    });
});
// PATCH /api/profile/me — update metadata fields
router.patch('/me', auth_middleware_1.requireAuth, async (req, res) => {
    const parsed = ProfileSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
        return;
    }
    const { data: existing } = await supabase_1.supabaseAdmin.auth.admin.getUserById(req.userId);
    const currentMeta = existing?.user?.user_metadata ?? {};
    const { data, error } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(req.userId, {
        user_metadata: { ...currentMeta, ...parsed.data },
    });
    if (error) {
        res.status(500).json({ error: 'Failed to update profile.' });
        return;
    }
    res.json({ user: data.user });
});
exports.default = router;
