import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }

  const token = header.slice(7);

  // Delega a validação ao Supabase Auth — funciona com JWT legacy (HS256)
  // e com JWT signing keys assimétricas (ES256/RS256) sem precisar do JWT_SECRET.
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  req.userId    = data.user.id;
  req.userEmail = data.user.email;
  next();
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (!error && data.user) {
    req.userId = data.user.id;
    req.userEmail = data.user.email;
  }

  next();
}
