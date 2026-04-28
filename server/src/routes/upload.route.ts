import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { uploadSingle } from '../middleware/upload.middleware';
import { processImage } from '../lib/image-processor';
import { supabaseAdmin } from '../supabase';

const router = Router();
const BUCKET = 'workout-photos';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload/post-photo
// Recebe imagem via multipart, processa com sharp e salva 3 tamanhos no Storage.
// Retorna URLs públicas: { thumb, medium, full }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/post-photo',
  requireAuth,
  uploadSingle('photo'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhuma imagem enviada.' });
      return;
    }

    const userId = req.userId!;
    const id     = randomUUID();
    const base   = `${userId}/${id}`;

    let sizes;
    try {
      sizes = await processImage(req.file.buffer);
    } catch (err) {
      console.error('[upload] processImage error:', err);
      res.status(422).json({ error: 'Não foi possível processar a imagem.' });
      return;
    }

    const uploads = await Promise.all([
      supabaseAdmin.storage.from(BUCKET).upload(`${base}_thumb.webp`,  sizes.thumb.buffer,  { contentType: 'image/webp', upsert: false }),
      supabaseAdmin.storage.from(BUCKET).upload(`${base}_medium.webp`, sizes.medium.buffer, { contentType: 'image/webp', upsert: false }),
      supabaseAdmin.storage.from(BUCKET).upload(`${base}_full.webp`,   sizes.full.buffer,   { contentType: 'image/webp', upsert: false }),
    ]);

    const failed = uploads.find(u => u.error);
    if (failed?.error) {
      console.error('[upload] storage error:', failed.error);
      res.status(500).json({ error: 'Falha ao salvar imagem no storage.' });
      return;
    }

    const url = (path: string) =>
      supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    res.status(201).json({
      thumb:  url(`${base}_thumb.webp`),
      medium: url(`${base}_medium.webp`),
      full:   url(`${base}_full.webp`),
    });
  },
);

export default router;
