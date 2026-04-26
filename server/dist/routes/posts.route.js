"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
const PostSchema = zod_1.z.object({
    caption: zod_1.z.string().max(500).optional(),
    photo_url: zod_1.z.string().url().optional(),
    workout_name: zod_1.z.string().max(80).optional(),
    workout_muscle: zod_1.z.string().max(30).optional(),
}).refine(d => d.caption?.trim() || d.photo_url || d.workout_name, { message: 'O post precisa ter ao menos foto, descrição ou treino.' });
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts — feed público (paginado), com dados do autor
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth_middleware_1.requireAuth, async (req, res) => {
    const limit = Math.min(Number(req.query['limit']) || 20, 50);
    const offset = Math.max(Number(req.query['offset']) || 0, 0);
    const { data: posts, error } = await supabase_1.supabaseAdmin
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        console.error('[posts] list error:', error);
        res.status(500).json({ error: 'Failed to fetch posts.' });
        return;
    }
    const enriched = await enrichWithAuthorsAndLikes(posts ?? [], req.userId);
    res.json({ posts: enriched, limit, offset });
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/user/:userId — posts de um usuário específico
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user/:userId', auth_middleware_1.requireAuth, async (req, res) => {
    const userId = req.params['userId'];
    if (!userId) {
        res.status(400).json({ error: 'Missing userId.' });
        return;
    }
    const { data: posts, error } = await supabase_1.supabaseAdmin
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) {
        res.status(500).json({ error: 'Failed to fetch user posts.' });
        return;
    }
    const enriched = await enrichWithAuthorsAndLikes(posts ?? [], req.userId);
    res.json({ posts: enriched });
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts — cria novo post
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', auth_middleware_1.requireAuth, async (req, res) => {
    const parsed = PostSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
        return;
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('posts')
        .insert({
        user_id: req.userId,
        caption: parsed.data.caption ?? null,
        photo_url: parsed.data.photo_url ?? null,
        workout_name: parsed.data.workout_name ?? null,
        workout_muscle: parsed.data.workout_muscle ?? null,
    })
        .select()
        .single();
    if (error) {
        console.error('[posts] insert error:', error);
        res.status(500).json({ error: 'Failed to create post.' });
        return;
    }
    const [enriched] = await enrichWithAuthorsAndLikes([data], req.userId);
    res.status(201).json({ post: enriched });
});
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:id — apaga post (somente autor)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', auth_middleware_1.requireAuth, async (req, res) => {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ error: 'Missing id.' });
        return;
    }
    const { data: existing, error: fetchErr } = await supabase_1.supabaseAdmin
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
            await supabase_1.supabaseAdmin.storage.from('workout-photos').remove([path]);
        }
    }
    const { error: delErr } = await supabase_1.supabaseAdmin.from('posts').delete().eq('id', id);
    if (delErr) {
        res.status(500).json({ error: 'Failed to delete post.' });
        return;
    }
    res.status(204).send();
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:id/like — toggle like
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/like', auth_middleware_1.requireAuth, async (req, res) => {
    const postId = req.params['id'];
    if (!postId) {
        res.status(400).json({ error: 'Missing id.' });
        return;
    }
    // Already liked?
    const { data: existing } = await supabase_1.supabaseAdmin
        .from('post_likes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', req.userId)
        .maybeSingle();
    if (existing) {
        await supabase_1.supabaseAdmin
            .from('post_likes')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', req.userId);
        res.json({ liked: false });
        return;
    }
    const { error } = await supabase_1.supabaseAdmin
        .from('post_likes')
        .insert({ post_id: postId, user_id: req.userId });
    if (error) {
        res.status(500).json({ error: 'Failed to like post.' });
        return;
    }
    res.json({ liked: true });
});
async function enrichWithAuthorsAndLikes(posts, currentUserId) {
    if (posts.length === 0)
        return [];
    const userIds = Array.from(new Set(posts.map(p => p.user_id)));
    // Fetch authors in parallel
    const authors = await Promise.all(userIds.map(id => supabase_1.supabaseAdmin.auth.admin.getUserById(id)));
    const userMap = new Map();
    for (const a of authors) {
        if (a.data?.user)
            userMap.set(a.data.user.id, a.data.user);
    }
    // Likes given by the current user across these posts
    const postIds = posts.map(p => p.id);
    const { data: myLikes } = await supabase_1.supabaseAdmin
        .from('post_likes')
        .select('post_id')
        .eq('user_id', currentUserId)
        .in('post_id', postIds);
    const likedSet = new Set((myLikes ?? []).map(l => l.post_id));
    return posts.map(p => {
        const u = userMap.get(p.user_id);
        const meta = u?.user_metadata ?? {};
        return {
            id: p.id,
            caption: p.caption,
            photo_url: p.photo_url,
            workout: p.workout_name ? { name: p.workout_name, muscleGroup: p.workout_muscle ?? '' } : null,
            likes: p.likes,
            comments: p.comments,
            liked: likedSet.has(p.id),
            created_at: p.created_at,
            time_ago: timeAgo(p.created_at),
            user: {
                id: p.user_id,
                name: meta['full_name'] || u?.email?.split('@')[0] || 'Usuário',
                username: meta['username'] || null,
                avatar: resolveAvatarUrl(meta['avatar_url']),
                level: 'Elite',
            },
        };
    });
}
function resolveAvatarUrl(path) {
    if (!path)
        return '';
    if (path.startsWith('http'))
        return path;
    const { data } = supabase_1.supabaseAdmin.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
}
function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60)
        return 'agora';
    const min = Math.floor(sec / 60);
    if (min < 60)
        return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24)
        return `${hr}h`;
    const d = Math.floor(hr / 24);
    if (d < 7)
        return `${d}d`;
    const w = Math.floor(d / 7);
    if (w < 4)
        return `${w}sem`;
    const mo = Math.floor(d / 30);
    return `${mo}mes`;
}
exports.default = router;
