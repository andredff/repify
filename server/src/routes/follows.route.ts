import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();

// ── POST /api/follows/:targetId — seguir usuário ──────────────────────────────
router.post('/:targetId', requireAuth, async (req: AuthRequest, res: Response) => {
  const followerId  = req.userId!;
  const followingId = req.params['targetId'];

  if (followerId === followingId) {
    res.status(400).json({ error: 'Cannot follow yourself.' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('user_follows')
    .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });

  if (error) {
    console.error('[follows] follow error:', error);
    res.status(500).json({ error: 'Failed to follow user.' });
    return;
  }

  res.json({ ok: true });
});

// ── DELETE /api/follows/:targetId — deixar de seguir ─────────────────────────
router.delete('/:targetId', requireAuth, async (req: AuthRequest, res: Response) => {
  const followerId  = req.userId!;
  const followingId = req.params['targetId'];

  const { error } = await supabaseAdmin
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) {
    console.error('[follows] unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user.' });
    return;
  }

  res.json({ ok: true });
});

// ── GET /api/follows/:userId/status — verifica se estou seguindo ──────────────
router.get('/:userId/status', requireAuth, async (req: AuthRequest, res: Response) => {
  const me     = req.userId!;
  const target = req.params['userId'];

  const { data, error } = await supabaseAdmin
    .from('user_follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('follower_id', me)
    .eq('following_id', target);

  if (error) {
    res.status(500).json({ error: 'Failed to check follow status.' });
    return;
  }

  res.json({ following: (data !== null && (data as any[]).length > 0) || false });
});

// ── GET /api/follows/:userId/counts — contagem de seguidores/seguindo ─────────
router.get('/:userId/counts', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.params['userId'];

  const [{ count: followers }, { count: following }] = await Promise.all([
    supabaseAdmin
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId),
    supabaseAdmin
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ]);

  res.json({ followers: followers ?? 0, following: following ?? 0 });
});

// ── GET /api/follows/:userId/followers — lista de seguidores ──────────────────
router.get('/:userId/followers', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.params['userId'];
  const me     = req.userId!;

  const { data, error } = await supabaseAdmin
    .from('user_follows')
    .select('follower_id')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    res.status(500).json({ error: 'Failed to fetch followers.' });
    return;
  }

  const ids = (data ?? []).map(r => r.follower_id as string);
  const users = await enrichUsers(ids, me);
  res.json({ users });
});

// ── GET /api/follows/:userId/following — lista de quem o usuário segue ────────
router.get('/:userId/following', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.params['userId'];
  const me     = req.userId!;

  const { data, error } = await supabaseAdmin
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    res.status(500).json({ error: 'Failed to fetch following.' });
    return;
  }

  const ids = (data ?? []).map(r => r.following_id as string);
  const users = await enrichUsers(ids, me);
  res.json({ users });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enrichUsers(ids: string[], viewerId: string) {
  if (ids.length === 0) return [];

  // Fetch user metadata
  const profiles = await Promise.all(
    ids.map(id => supabaseAdmin.auth.admin.getUserById(id))
  );

  // Fetch which of these users the viewer follows
  const { data: viewerFollows } = await supabaseAdmin
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', viewerId)
    .in('following_id', ids);

  const followingSet = new Set((viewerFollows ?? []).map(r => r.following_id as string));

  return profiles
    .filter(r => r.data.user)
    .map(r => {
      const user = r.data.user!;
      const meta = user.user_metadata ?? {};
      return {
        id:          user.id,
        name:        meta['full_name'] || user.email?.split('@')[0] || 'Usuário',
        username:    meta['username'] || null,
        avatar:      resolveAvatarUrl(meta['avatar_url']),
        level:       meta['level'] || 'Iniciante',
        isFollowing: followingSet.has(user.id),
      };
    });
}

function resolveAvatarUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export default router;
