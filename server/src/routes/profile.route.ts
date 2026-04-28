import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();

const ProfileSchema = z.object({
  full_name:     z.string().max(60).optional(),
  username:      z.string().max(30).regex(/^[a-z0-9_.]*$/).optional(),
  bio:           z.string().max(500).optional(),
  weight:        z.number().min(20).max(400).nullable().optional(),
  height:        z.number().min(50).max(300).nullable().optional(),
  goal:          z.string().max(50).optional(),
  yearly_goal:   z.number().int().min(1).max(999).nullable().optional(),
  weekly_goal_days: z.number().int().min(3).max(5).nullable().optional(),
  weekly_goal_completed_weeks: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(156).optional(),
  weekly_goal_best_streak: z.number().int().min(0).max(520).nullable().optional(),
});

// GET /api/profile/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(req.userId!);

  if (error || !data.user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { count: workoutsDone, error: workoutCountError } = await supabaseAdmin
    .from('xp_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.userId!)
    .eq('type', 'workout');

  if (workoutCountError) {
    console.error('[profile] xp_events count error:', workoutCountError);
    res.status(500).json({ error: 'Failed to load profile.' });
    return;
  }

  const meta = data.user.user_metadata ?? {};
  res.json({
    id:        data.user.id,
    email:     data.user.email,
    full_name: meta['full_name'] ?? '',
    username:  meta['username']  ?? '',
    bio:       meta['bio']       ?? '',
    weight:    meta['weight']    ?? null,
    height:    meta['height']    ?? null,
    goal:      meta['goal']      ?? '',
    avatar_url:meta['avatar_url']?? '',
    yearly_goal: meta['yearly_goal'] ?? null,
    weekly_goal_days: meta['weekly_goal_days'] ?? null,
    weekly_goal_completed_weeks: Array.isArray(meta['weekly_goal_completed_weeks']) ? meta['weekly_goal_completed_weeks'] : [],
    weekly_goal_best_streak: meta['weekly_goal_best_streak'] ?? 0,
    workouts_done: Number(workoutsDone ?? meta['workouts_done'] ?? 0),
  });
});

// PATCH /api/profile/me — update metadata fields
router.patch('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = ProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const { data: existing } = await supabaseAdmin.auth.admin.getUserById(req.userId!);
  const currentMeta = existing?.user?.user_metadata ?? {};

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(req.userId!, {
    user_metadata: { ...currentMeta, ...parsed.data },
  });

  if (error) {
    res.status(500).json({ error: 'Failed to update profile.' });
    return;
  }

  res.json({ user: data.user });
});

export default router;
