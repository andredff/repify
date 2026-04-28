"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
const supabase_1 = require("../supabase");
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header.' });
        return;
    }
    const token = header.slice(7);
    // Delega a validação ao Supabase Auth — funciona com JWT legacy (HS256)
    // e com JWT signing keys assimétricas (ES256/RS256) sem precisar do JWT_SECRET.
    const { data, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
        res.status(401).json({ error: 'Invalid or expired token.' });
        return;
    }
    req.userId = data.user.id;
    req.userEmail = data.user.email;
    next();
}
async function optionalAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        next();
        return;
    }
    const token = header.slice(7);
    const { data, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
    if (!error && data.user) {
        req.userId = data.user.id;
        req.userEmail = data.user.email;
    }
    next();
}
