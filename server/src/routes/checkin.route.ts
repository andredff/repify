import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();

const CheckInSchema = z.object({
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gym_name:  z.string().max(120).optional(),
  notes:     z.string().max(500).optional(),
});

// POST /api/checkin — register a GPS check-in
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = CheckInSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const { latitude, longitude, gym_name, notes } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('checkins')
    .insert({
      user_id:   req.userId,
      latitude,
      longitude,
      gym_name:  gym_name ?? null,
      notes:     notes    ?? null,
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
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const limit  = Math.min(Number(req.query['limit'])  || 20, 100);
  const offset = Math.max(Number(req.query['offset']) || 0,  0);

  const { data, error } = await supabaseAdmin
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

export default router;
