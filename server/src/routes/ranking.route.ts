import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();

type RankSort = 'xp' | 'workouts' | 'distance';

interface RankingUserMeta {
  name: string;
  username: string | null;
  avatar: string;
  workoutsDone: number;
}

interface RankingStatsRow {
  user_id: string;
  total_xp?: number | null;
  weekly_xp?: number | null;
  streak_days?: number | null;
  total_walk_km?: number | null;
}

interface XpEventRow {
  user_id: string;
  type?: string | null;
}

interface RankingEntry {
  rank: number;
  userId: string;
  name: string;
  username: string | null;
  avatar: string;
  totalXp: number;
  workoutsDone: number;
  totalKm: number;
  weeklyXp: number;
  streakDays: number;
}

function cleanString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'null' || normalized.toLowerCase() === 'undefined') return '';
  return normalized;
}

function resolveAvatarUrl(path: unknown, version: unknown = null): string {
  const avatarPath = cleanString(path);
  if (!avatarPath) return '';

  const avatarVersion = typeof version === 'number' ? version : null;
  if (avatarPath.startsWith('http')) {
    return avatarVersion ? `${avatarPath}?v=${avatarVersion}` : avatarPath;
  }

  const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(avatarPath);
  return avatarVersion ? `${data.publicUrl}?v=${avatarVersion}` : data.publicUrl;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function listAllUsers() {
  const users: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const chunk = data.users ?? [];
    users.push(...(chunk as any));
    if (chunk.length < 1000) break;
    page++;
  }
  return users;
}

async function enrichUsers() {
  const users = await listAllUsers();
  const map = new Map<string, RankingUserMeta>();
  for (const u of users) {
    const meta = u.user_metadata ?? {};
    const fullName = cleanString(meta['full_name']);
    const username = cleanString(meta['username']);
    const avatarUrl = resolveAvatarUrl(meta['avatar_url'], meta['avatar_version']);

    map.set(u.id, {
      name:     fullName || u.email?.split('@')[0] || 'Usuário',
      username: username || null,
      avatar:   avatarUrl,
      workoutsDone: 0,
    });
  }
  return map;
}

function sortEntries(entries: RankingEntry[], sort: RankSort): RankingEntry[] {
  const sorted = [...entries].sort((left, right) => {
    const primary = sort === 'workouts'
      ? right.workoutsDone - left.workoutsDone
      : sort === 'distance'
        ? right.totalKm - left.totalKm
        : right.totalXp - left.totalXp;

    if (primary !== 0) return primary;
    if (right.totalXp !== left.totalXp) return right.totalXp - left.totalXp;
    if (right.workoutsDone !== left.workoutsDone) return right.workoutsDone - left.workoutsDone;
    if (right.totalKm !== left.totalKm) return right.totalKm - left.totalKm;
    return left.name.localeCompare(right.name, 'pt-BR');
  });

  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// ── GET /api/ranking — leaderboard completo com paginação ───────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const sort: RankSort = req.query['sort'] === 'workouts'
    ? 'workouts'
    : req.query['sort'] === 'distance'
      ? 'distance'
      : 'xp';
  const page  = Math.max(Number(req.query['page']) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query['limit']) || 20, 1), 50);

  const userMap = await enrichUsers().catch(error => {
    console.error('[ranking] listUsers error:', error);
    return null;
  });

  if (!userMap) {
    res.status(500).json({ error: 'Failed to load ranking.' });
    return;
  }

  const { data: statsRows, error } = await supabaseAdmin
    .from('user_stats')
    .select('*');

  if (error) {
    console.error('[ranking] user_stats error:', error);
    res.status(500).json({ error: 'Failed to load ranking.' });
    return;
  }

  const { data: xpEvents, error: xpEventsError } = await supabaseAdmin
    .from('xp_events')
    .select('user_id, type')
    .eq('type', 'workout');

  if (xpEventsError) {
    console.error('[ranking] xp_events error:', xpEventsError);
    res.status(500).json({ error: 'Failed to load ranking.' });
    return;
  }

  const statsMap = new Map<string, RankingStatsRow>();
  for (const row of (statsRows ?? []) as RankingStatsRow[]) {
    statsMap.set(row.user_id, row);
  }

  const workoutCountMap = new Map<string, number>();
  for (const event of (xpEvents ?? []) as XpEventRow[]) {
    if (!event.user_id) continue;
    workoutCountMap.set(event.user_id, (workoutCountMap.get(event.user_id) ?? 0) + 1);
  }

  const allEntries = sortEntries(
    Array.from(userMap.entries()).map(([userId, user]) => {
      const stats = statsMap.get(userId);
      return {
        rank: 0,
        userId,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        totalXp: Number(stats?.total_xp ?? 0),
        workoutsDone: Number(workoutCountMap.get(userId) ?? user.workoutsDone ?? 0),
        totalKm: Number(stats?.total_walk_km ?? 0),
        weeklyXp: Number(stats?.weekly_xp ?? 0),
        streakDays: Number(stats?.streak_days ?? 0),
      } satisfies RankingEntry;
    }),
    sort,
  );

  const start = (page - 1) * limit;
  const end = start + limit;
  const entries = allEntries.slice(start, end);
  const me = allEntries.find(entry => entry.userId === req.userId!) ?? null;

  res.json({
    sort,
    entries,
    me,
    page,
    limit,
    total: allEntries.length,
    hasMore: end < allEntries.length,
  });
});

// ── POST /api/ranking/xp — record XP event and upsert user_stats ─────────────
const XpSchema = z.object({
  type:       z.enum(['workout', 'walk', 'streak_bonus']),
  xp:         z.number().int().min(1).max(500),
  streakDays: z.number().int().min(0).optional(),
  distanceKm: z.number().min(0).max(500).optional(),
});

router.post('/xp', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = XpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message });
    return;
  }
  const { type, xp, streakDays, distanceKm } = parsed.data;
  const userId = req.userId!;

  // Upsert user_stats — reset weekly_xp if week rolled over
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Fetch current stats
  const { data: existing } = await supabaseAdmin
    .from('user_stats')
    .select('total_xp, weekly_xp, week_start, total_walk_km, streak_days')
    .eq('user_id', userId)
    .maybeSingle();

  const weekRolled = existing && existing.week_start !== weekStartStr;
  const prevTotal  = existing?.total_xp  ?? 0;
  const prevWeekly = weekRolled ? 0 : (existing?.weekly_xp ?? 0);
  const prevWalkKm = Number((existing as { total_walk_km?: number } | null)?.total_walk_km ?? 0);

  const { error: upsertError } = await supabaseAdmin
    .from('user_stats')
    .upsert({
      user_id:     userId,
      total_xp:    prevTotal + xp,
      weekly_xp:   prevWeekly + xp,
      streak_days: streakDays ?? (existing as { streak_days?: number } | null)?.streak_days ?? 0,
      total_walk_km: prevWalkKm + (type === 'walk' ? Number(distanceKm ?? 0) : 0),
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


