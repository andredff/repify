"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
// ── GET /api/notifications — lista notificações do usuário autenticado ────────
router.get('/', auth_middleware_1.requireAuth, async (req, res) => {
    const limit = Math.min(Number(req.query['limit']) || 30, 100);
    const offset = Math.max(Number(req.query['offset']) || 0, 0);
    const { data, error } = await supabase_1.supabaseAdmin
        .from('notifications')
        .select('id, type, post_id, body, read_at, created_at, actor_id')
        .eq('recipient_id', req.userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        console.error('[notif] list error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications.' });
        return;
    }
    const rows = data ?? [];
    // Enrich actor info
    const actorIds = Array.from(new Set(rows.map(n => n.actor_id).filter(Boolean)));
    const actorMap = new Map();
    await Promise.all(actorIds.map(async (id) => {
        const { data: { user } } = await supabase_1.supabaseAdmin.auth.admin.getUserById(id);
        if (!user)
            return;
        const meta = user.user_metadata ?? {};
        actorMap.set(id, {
            name: meta['full_name'] || user.email?.split('@')[0] || 'Usuário',
            username: meta['username'] || null,
            avatar: resolveAvatarUrl(meta['avatar_url']),
        });
    }));
    const notifications = rows.map(n => ({
        id: n.id,
        type: n.type,
        post_id: n.post_id,
        body: n.body,
        read: !!n.read_at,
        created_at: n.created_at,
        time_ago: timeAgo(n.created_at),
        actor: n.actor_id ? (actorMap.get(n.actor_id) ?? null) : null,
    }));
    res.json({ notifications, total: rows.length });
});
// ── GET /api/notifications/unread-count ───────────────────────────────────────
router.get('/unread-count', auth_middleware_1.requireAuth, async (req, res) => {
    const { count, error } = await supabase_1.supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', req.userId)
        .is('read_at', null);
    if (error) {
        res.status(500).json({ error: 'Failed to count.' });
        return;
    }
    res.json({ count: count ?? 0 });
});
// ── POST /api/notifications/read-all — marca todas como lidas ─────────────────
router.post('/read-all', auth_middleware_1.requireAuth, async (req, res) => {
    const { error } = await supabase_1.supabaseAdmin
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', req.userId)
        .is('read_at', null);
    if (error) {
        res.status(500).json({ error: 'Failed to mark as read.' });
        return;
    }
    res.json({ ok: true });
});
// ── POST /api/notifications/:id/read — marca uma como lida ───────────────────
router.post('/:id/read', auth_middleware_1.requireAuth, async (req, res) => {
    const id = req.params['id'];
    const { error } = await supabase_1.supabaseAdmin
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('recipient_id', req.userId)
        .is('read_at', null);
    if (error) {
        res.status(500).json({ error: 'Failed to mark as read.' });
        return;
    }
    res.json({ ok: true });
});
// ── POST /api/notifications/push — cria notificação manual (workout/walk) ─────
// Called by the client when a user finishes a workout or walk session + posts it
router.post('/push', auth_middleware_1.requireAuth, async (req, res) => {
    const { type, recipient_ids, post_id } = req.body;
    if (!type || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
        res.status(400).json({ error: 'Missing type or recipient_ids.' });
        return;
    }
    const allowed = ['workout', 'walk'];
    if (!allowed.includes(type)) {
        res.status(400).json({ error: 'Invalid type for manual push.' });
        return;
    }
    const rows = recipient_ids
        .filter(id => id !== req.userId) // never notify yourself
        .slice(0, 200)
        .map(rid => ({
        recipient_id: rid,
        actor_id: req.userId,
        type,
        post_id: post_id ?? null,
    }));
    if (rows.length === 0) {
        res.json({ ok: true, sent: 0 });
        return;
    }
    const { error } = await supabase_1.supabaseAdmin.from('notifications').insert(rows);
    if (error) {
        console.error('[notif] push error:', error);
        res.status(500).json({ error: 'Failed to send notifications.' });
        return;
    }
    res.json({ ok: true, sent: rows.length });
});
// ── Helpers ───────────────────────────────────────────────────────────────────
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
    return `${Math.floor(d / 30)}mes`;
}
exports.default = router;
