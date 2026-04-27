import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────

async function enrichUsers(userIds: string[]) {
  if (!userIds.length) return new Map<string, { name: string; username: string | null; avatar: string }>();
  const { data } = await supabaseAdmin.auth.admin.listUsers();
  const map = new Map<string, { name: string; username: string | null; avatar: string }>();
  for (const u of data?.users ?? []) {
    if (!userIds.includes(u.id)) continue;
    const meta = u.user_metadata ?? {};
    const avatarPath: string = meta['avatar_url'] ?? '';
    const version: number | null = meta['avatar_version'] ?? null;
    let avatarUrl = '';
    if (avatarPath) {
      if (avatarPath.startsWith('http')) {
        avatarUrl = version ? `${avatarPath}?v=${version}` : avatarPath;
      } else {
        const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(avatarPath);
        avatarUrl = version ? `${pub.publicUrl}?v=${version}` : pub.publicUrl;
      }
    }
    map.set(u.id, {
      name:     meta['full_name'] || u.email?.split('@')[0] || 'Usuário',
      username: meta['username'] ?? null,
      avatar:   avatarUrl,
    });
  }
  return map;
}

// ── GET /api/ranking — leaderboard global ou semanal ─────────────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const mode  = req.query['mode'] === 'weekly' ? 'weekly' : 'global';
  const limit = Math.min(Number(req.query['limit']) || 10, 50);

  const { data: rows, error } = await supabaseAdmin.rpc('get_ranking', {
    p_mode: mode, p_limit: limit,
  });

  if (error) {
    console.error('[ranking] get_ranking error:', error);
    res.status(500).json({ error: 'Failed to load ranking.' });
    return;
  }

  const userIds = (rows ?? []).map((r: { user_id: string }) => r.user_id);
  const userMap = await enrichUsers(userIds);

  const entries = (rows ?? []).map((r: {
    rank: number; user_id: string; total_xp: number; weekly_xp: number; streak_days: number;
  }) => {
    const u = userMap.get(r.user_id);
    return {
      rank:        r.rank,
      userId:      r.user_id,
      totalXp:     r.total_xp,
      weeklyXp:    r.weekly_xp,
      streakDays:  r.streak_days,
      xp:          mode === 'weekly' ? r.weekly_xp : r.total_xp,
      name:        u?.name     ?? 'Usuário',
      username:    u?.username ?? null,
      avatar:      u?.avatar   ?? '',
    };
  });

  // Also return caller's own position
  const { data: myRank } = await supabaseAdmin.rpc('get_user_rank', {
    p_user_id: req.userId!, p_mode: mode,
  });
  const me = myRank?.[0] ?? null;

  res.json({ mode, entries, me });
});

// ── POST /api/ranking/xp — record XP event and upsert user_stats ─────────────
const XpSchema = z.object({
  type:       z.enum(['workout', 'walk', 'streak_bonus']),
  xp:         z.number().int().min(1).max(500),
  streakDays: z.number().int().min(0).optional(),
});

router.post('/xp', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = XpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message });
    return;
  }
  const { type, xp, streakDays } = parsed.data;
  const userId = req.userId!;

  // Upsert user_stats — reset weekly_xp if week rolled over
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Fetch current stats
  const { data: existing } = await supabaseAdmin
    .from('user_stats')
    .select('total_xp, weekly_xp, week_start')
    .eq('user_id', userId)
    .maybeSingle();

  const weekRolled = existing && existing.week_start !== weekStartStr;
  const prevTotal  = existing?.total_xp  ?? 0;
  const prevWeekly = weekRolled ? 0 : (existing?.weekly_xp ?? 0);

  const { error: upsertError } = await supabaseAdmin
    .from('user_stats')
    .upsert({
      user_id:     userId,
      total_xp:    prevTotal + xp,
      weekly_xp:   prevWeekly + xp,
      streak_days: streakDays ?? (existing as { streak_days?: number } | null)?.streak_days ?? 0,
      week_start:  weekStartStr,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (upsertError) {
    console.error('[ranking] upsert error:', upsertError);
    res.status(500).json({ error: 'Failed to record XP.' });
    return;
  }

  // Audit log
  await supabaseAdmin.from('xp_events').insert({ user_id: userId, type, xp });

  res.json({ ok: true, totalXp: prevTotal + xp, weeklyXp: prevWeekly + xp });
});

export default router;
