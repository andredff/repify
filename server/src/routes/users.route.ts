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
  created_at: string;
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

  const users = (data.users ?? [])
    .filter(u => u.id !== req.userId)
    .map(toPublicUser);

  res.json({ users, page, limit });
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
    res.json({ user: toPublicUser(data.user) });
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

  res.json({ user: toPublicUser(user) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toPublicUser(u: any): PublicUser {
  const meta = u.user_metadata ?? {};
  return {
    id:           u.id,
    email:        u.email ?? '',
    name:         meta['full_name'] || u.email?.split('@')[0] || 'Usuário',
    username:     meta['username']  || null,
    bio:          meta['bio']       || '',
    avatar:       resolveAvatarUrl(meta['avatar_url']),
    goal:         meta['goal']      || '',
    level:        'Elite',
    yearly_goal:  meta['yearly_goal']   ?? null,
    workouts_done:meta['workouts_done'] ?? null,
    created_at:   u.created_at,
  };
}

function resolveAvatarUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export default router;
