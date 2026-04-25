import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, config.supabaseJwtSecret) as jwt.JwtPayload;
    req.userId    = payload['sub'] as string;
    req.userEmail = payload['email'] as string;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
