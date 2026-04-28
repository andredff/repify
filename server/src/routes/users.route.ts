import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();

interface PublicUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  bio: string;
  avatar: string;
  goal: string;
  level: string;
  yearly_goal: number | null;
  workouts_done: number | null;
  total_xp: number;
  total_walk_km: number;
  streak_days: number;
  created_at: string;
  last_sign_in_at: string | null;
}

interface UserStatsRow {
  user_id: string;
  total_xp?: number | null;
  streak_days?: number | null;
  total_walk_km?: number | null;
}

interface XpEventRow {
  user_id: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users — lista usuários (exclui o atual), com paginação
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(Number(req.query['limit']) || 30, 100);
  const page  = Math.max(Number(req.query['page'])  || 1, 1);

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: limit });

  if (error) {
    console.error('[users] list error:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
    return;
  }

  const users = (data.users ?? []).filter(u => u.id !== req.userId);
  const enriched = await enrichUsers(users);

  res.json({ users: enriched, page, limit });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/:handle — busca usuário por id ou username
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:handle', requireAuth, async (req: AuthRequest, res: Response) => {
  const handleRaw = req.params['handle'];
  const handle = Array.isArray(handleRaw) ? handleRaw[0] : handleRaw;
  if (!handle) { res.status(400).json({ error: 'Missing handle.' }); return; }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handle);

  if (isUuid) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(handle);
    if (error || !data.user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const [user] = await enrichUsers([data.user]);
    res.json({ user: user ?? null });
    return;
  }

  // Busca por username — listUsers retorna até 1000 por página, suficiente p/ MVP
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    res.status(500).json({ error: 'Failed to lookup user.' });
    return;
  }

  const user = (data.users ?? []).find(
    u => u.user_metadata?.['username']?.toLowerCase() === handle.toLowerCase(),
  );

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const [enriched] = await enrichUsers([user]);
  res.json({ user: enriched ?? null });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function enrichUsers(users: any[]): Promise<PublicUser[]> {
  if (users.length === 0) return [];

  const userIds = users.map(user => user.id);

  const [{ data: statsRows }, { data: workoutRows }] = await Promise.all([
    supabaseAdmin
      .from('user_stats')
      .select('user_id, total_xp, streak_days, total_walk_km')
      .in('user_id', userIds),
    supabaseAdmin
      .from('xp_events')
      .select('user_id')
      .eq('type', 'workout')
      .in('user_id', userIds),
  ]);

  const statsMap = new Map<string, UserStatsRow>();
  for (const row of (statsRows ?? []) as UserStatsRow[]) {
    statsMap.set(row.user_id, row);
  }

  const workoutMap = new Map<string, number>();
  for (const row of (workoutRows ?? []) as XpEventRow[]) {
    workoutMap.set(row.user_id, (workoutMap.get(row.user_id) ?? 0) + 1);
  }

  return users.map(user => toPublicUser(user, statsMap.get(user.id), workoutMap.get(user.id) ?? 0));
}

function toPublicUser(u: any, stats?: UserStatsRow, workoutsDone = 0): PublicUser {
  const meta = u.user_metadata ?? {};
  const totalXp = Number(stats?.total_xp ?? 0);
  return {
    id:           u.id,
    email:        u.email ?? '',
    name:         meta['full_name'] || u.email?.split('@')[0] || 'Usuário',
    username:     meta['username']  || null,
    bio:          meta['bio']       || '',
    avatar:       resolveAvatarUrl(meta['avatar_url']),
    goal:         meta['goal']      || '',
    level:        levelFromXp(totalXp),
    yearly_goal:  meta['yearly_goal']   ?? null,
    workouts_done:workoutsDone,
    total_xp:     totalXp,
    total_walk_km:Number(stats?.total_walk_km ?? 0),
    streak_days:  Number(stats?.streak_days ?? 0),
    created_at:   u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
  };
}

function levelFromXp(totalXp: number): string {
  if (totalXp >= 1500) return 'Elite';
  if (totalXp >= 900) return 'Pro';
  if (totalXp >= 500) return 'Avançado';
  if (totalXp >= 200) return 'Intermediário';
  return 'Iniciante';
}

function resolveAvatarUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export default router;
