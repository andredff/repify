import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../supabase';

const router = Router();

const PostSchema = z.object({
  caption:        z.string().max(500).optional(),
  photo_url:      z.string().url().optional(),
  workout_name:   z.string().max(80).optional(),
  workout_muscle: z.string().max(30).optional(),
}).refine(
  d => d.caption?.trim() || d.photo_url || d.workout_name,
  { message: 'O post precisa ter ao menos foto, descrição ou treino.' },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/public/:id — dados de um post sem autenticação (link público)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/public/:id', async (req, res: Response) => {
  const id = req.params['id'];
  if (!id) { res.status(400).json({ error: 'Missing id.' }); return; }

  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !post) { res.status(404).json({ error: 'Post not found.' }); return; }

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(post.user_id);
  const meta = user?.user_metadata ?? {};

  const [{ data: statsRow }, { data: workoutRows }, { data: streakRow }] = await Promise.all([
    supabaseAdmin.from('user_stats').select('total_xp').eq('user_id', post.user_id).maybeSingle(),
    supabaseAdmin.from('xp_events').select('user_id').eq('type', 'workout').eq('user_id', post.user_id),
    supabaseAdmin.from('user_stats').select('streak_days').eq('user_id', post.user_id).maybeSingle(),
  ]);

  const totalXp      = Number((statsRow as any)?.total_xp ?? 0);
  const workoutsDone = (workoutRows ?? []).length;
  const streakDays   = Number((streakRow as any)?.streak_days ?? 0);

  res.json({
    post: {
      id:         post.id,
      caption:    post.caption,
      photo_url:  post.photo_url,
      workout:    post.workout_name ? { name: post.workout_name, muscleGroup: post.workout_muscle ?? '' } : null,
      likes:      post.likes,
      comments:   post.comments,
      created_at: post.created_at,
      time_ago:   timeAgo(post.created_at),
      user: {
        id:            post.user_id,
        name:          meta['full_name'] || user?.email?.split('@')[0] || 'Usuário',
        username:      meta['username']  || null,
        avatar:        resolveAvatarUrl(meta['avatar_url']),
        level:         levelFromXp(totalXp),
        yearly_goal:   meta['yearly_goal'] != null ? Number(meta['yearly_goal']) : null,
        workouts_done: workoutsDone,
        streak_days:   streakDays,
        total_xp:      totalXp,
      },
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts — feed público (paginado), com dados do autor
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  const limit  = Math.min(Number(req.query['limit'])  || 20, 50);
  const offset = Math.max(Number(req.query['offset']) || 0,  0);

  const { data: posts, error } = await supabaseAdmin
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[posts] list error:', error);
    res.status(500).json({ error: 'Failed to fetch posts.' });
    return;
  }

  const enriched = await enrichWithAuthorsAndLikes(posts ?? [], req.userId ?? null);
  res.json({ posts: enriched, limit, offset });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/user/:userId — posts de um usuário específico
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.params['userId'];
  if (!userId) { res.status(400).json({ error: 'Missing userId.' }); return; }

  const { data: posts, error } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch user posts.' });
    return;
  }

  const enriched = await enrichWithAuthorsAndLikes(posts ?? [], req.userId!);
  res.json({ posts: enriched });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts — cria novo post
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = PostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert({
      user_id:        req.userId,
      caption:        parsed.data.caption        ?? null,
      photo_url:      parsed.data.photo_url      ?? null,
      workout_name:   parsed.data.workout_name   ?? null,
      workout_muscle: parsed.data.workout_muscle ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[posts] insert error:', error);
    res.status(500).json({ error: 'Failed to create post.' });
    return;
  }

  const [enriched] = await enrichWithAuthorsAndLikes([data], req.userId!);
  res.status(201).json({ post: enriched });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:id — apaga post (somente autor)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = req.params['id'];
  if (!id) { res.status(400).json({ error: 'Missing id.' }); return; }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('posts')
    .select('user_id, photo_url')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !existing) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  if (existing.user_id !== req.userId) {
    res.status(403).json({ error: 'Not allowed.' });
    return;
  }

  // Remove storage photo if any
  if (existing.photo_url) {
    const marker = '/object/public/workout-photos/';
    const idx = existing.photo_url.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(existing.photo_url.slice(idx + marker.length).split('?')[0]);
      await supabaseAdmin.storage.from('workout-photos').remove([path]);
    }
  }

  const { error: delErr } = await supabaseAdmin.from('posts').delete().eq('id', id);
  if (delErr) {
    res.status(500).json({ error: 'Failed to delete post.' });
    return;
  }

  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/posts/:id — editar descrição (dono apenas)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id      = req.params['id'];
  const caption = (req.body?.caption ?? '').toString().trim().slice(0, 500);

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('posts').select('user_id').eq('id', id).maybeSingle();

  if (fetchErr || !existing) { res.status(404).json({ error: 'Post not found.' }); return; }
  if (existing.user_id !== req.userId) { res.status(403).json({ error: 'Not allowed.' }); return; }

  const { error } = await supabaseAdmin.from('posts').update({ caption }).eq('id', id);
  if (error) { res.status(500).json({ error: 'Failed to update post.' }); return; }

  res.json({ caption });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:id/like — toggle like
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  const postId = req.params['id'];
  if (!postId) { res.status(400).json({ error: 'Missing id.' }); return; }

  // Already liked?
  const { data: existing } = await supabaseAdmin
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', req.userId!)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', req.userId!);
    res.json({ liked: false });
    return;
  }

  const { error } = await supabaseAdmin
    .from('post_likes')
    .insert({ post_id: postId, user_id: req.userId });

  if (error) {
    res.status(500).json({ error: 'Failed to like post.' });
    return;
  }

  res.json({ liked: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/:id/comments — lista comentários do post
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  const postId = req.params['id'];
  const limit  = Math.min(Number(req.query['limit']) || 50, 100);
  const offset = Math.max(Number(req.query['offset']) || 0, 0);

  const { data, error } = await supabaseAdmin
    .from('post_comments')
    .select('id, body, user_id, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) { res.status(500).json({ error: 'Failed to fetch comments.' }); return; }

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map(c => c.user_id)));
  const authors = await Promise.all(userIds.map(id => supabaseAdmin.auth.admin.getUserById(id)));
  const userMap = new Map<string, any>();
  for (const a of authors) {
    if (a.data?.user) userMap.set(a.data.user.id, a.data.user);
  }

  const comments = rows.map(c => {
    const u    = userMap.get(c.user_id);
    const meta = u?.user_metadata ?? {};
    return {
      id:        c.id,
      body:      c.body,
      time_ago:  timeAgo(c.created_at),
      created_at: c.created_at,
      is_own:    c.user_id === req.userId,
      user: {
        id:       c.user_id,
        name:     meta['full_name'] || u?.email?.split('@')[0] || 'Usuário',
        username: meta['username'] || null,
        avatar:   resolveAvatarUrl(meta['avatar_url']),
      },
    };
  });

  res.json({ comments, total: rows.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:id/comments — adiciona comentário
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  const postId = req.params['id'];
  const body   = (req.body?.body ?? '').trim();

  if (!body || body.length > 500) {
    res.status(400).json({ error: 'Comentário inválido.' }); return;
  }

  const { data, error } = await supabaseAdmin
    .from('post_comments')
    .insert({ post_id: postId, user_id: req.userId, body })
    .select('id, body, user_id, created_at')
    .single();

  if (error) { res.status(500).json({ error: 'Failed to save comment.' }); return; }

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(req.userId!);
  const meta = user?.user_metadata ?? {};

  // Notify post owner (if not the same user)
  const { data: postRow } = await supabaseAdmin
    .from('posts').select('user_id').eq('id', postId).maybeSingle();
  if (postRow && postRow.user_id !== req.userId) {
    void supabaseAdmin.from('notifications').insert({
      recipient_id: postRow.user_id,
      actor_id:     req.userId,
      type:         'comment',
      post_id:      postId,
      body:         body.slice(0, 120),
    }); // non-critical, fire-and-forget
  }

  res.status(201).json({
    comment: {
      id:        data.id,
      body:      data.body,
      time_ago:  'agora',
      created_at: data.created_at,
      is_own:    true,
      user: {
        id:       req.userId,
        name:     meta['full_name'] || user?.email?.split('@')[0] || 'Usuário',
        username: meta['username'] || null,
        avatar:   resolveAvatarUrl(meta['avatar_url']),
      },
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:id/comments/:commentId — apaga comentário próprio
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/comments/:commentId', requireAuth, async (req: AuthRequest, res: Response) => {
  const commentId = req.params['commentId'];

  const { data: existing } = await supabaseAdmin
    .from('post_comments')
    .select('user_id')
    .eq('id', commentId)
    .maybeSingle();

  if (!existing) { res.status(404).json({ error: 'Comment not found.' }); return; }
  if (existing.user_id !== req.userId) { res.status(403).json({ error: 'Not allowed.' }); return; }

  await supabaseAdmin.from('post_comments').delete().eq('id', commentId);
  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface PostRow {
  id: string;
  user_id: string;
  caption: string | null;
  photo_url: string | null;
  workout_name: string | null;
  workout_muscle: string | null;
  likes: number;
  comments: number;
  created_at: string;
}

interface UserStatsRow {
  user_id: string;
  total_xp?: number | null;
}

interface XpEventRow {
  user_id: string;
}

async function enrichWithAuthorsAndLikes(posts: PostRow[], currentUserId: string | null) {
  if (posts.length === 0) return [];

  const userIds = Array.from(new Set(posts.map(p => p.user_id)));

  // Fetch authors in parallel
  const authors = await Promise.all(
    userIds.map(id => supabaseAdmin.auth.admin.getUserById(id)),
  );
  const userMap = new Map<string, any>();
  for (const a of authors) {
    if (a.data?.user) userMap.set(a.data.user.id, a.data.user);
  }

  // Likes given by the current user across these posts
  const postIds = posts.map(p => p.id);
  const myLikes = currentUserId
    ? (await supabaseAdmin
        .from('post_likes')
        .select('post_id')
        .eq('user_id', currentUserId)
        .in('post_id', postIds)).data
    : [];

  const [{ data: statsRows }, { data: workoutRows }] = await Promise.all([
    supabaseAdmin
      .from('user_stats')
      .select('user_id, total_xp')
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

  const likedSet = new Set((myLikes ?? []).map(l => l.post_id));

  return posts.map(p => {
    const u    = userMap.get(p.user_id);
    const meta = u?.user_metadata ?? {};
    const totalXp = Number(statsMap.get(p.user_id)?.total_xp ?? 0);
    return {
      id:          p.id,
      caption:     p.caption,
      photo_url:   p.photo_url,
      workout:     p.workout_name ? { name: p.workout_name, muscleGroup: p.workout_muscle ?? '' } : null,
      likes:       p.likes,
      comments:    p.comments,
      liked:       likedSet.has(p.id),
      created_at:  p.created_at,
      time_ago:    timeAgo(p.created_at),
      user: {
        id:           p.user_id,
        name:         meta['full_name'] || u?.email?.split('@')[0] || 'Usuário',
        username:     meta['username']  || null,
        avatar:       resolveAvatarUrl(meta['avatar_url']),
        level:        levelFromXp(totalXp),
        yearly_goal:  meta['yearly_goal']   != null ? Number(meta['yearly_goal'])   : null,
        workouts_done:workoutMap.get(p.user_id) ?? 0,
      },
    };
  });
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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60)        return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60)        return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr  < 24)        return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d   < 7)         return `${d}d`;
  const w = Math.floor(d / 7);
  if (w   < 4)         return `${w}sem`;
  const mo = Math.floor(d / 30);
  return `${mo}mes`;
}

export default router;
