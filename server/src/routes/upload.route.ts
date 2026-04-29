import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { uploadSingle, uploadVideoSingle } from '../middleware/upload.middleware';
import { processImage } from '../lib/image-processor';
import { compressVideo } from '../lib/video-processor';
import { supabaseAdmin } from '../supabase';

const router = Router();
const BUCKET       = 'workout-photos';
const VIDEO_BUCKET = 'workout-videos';

// Ensure the video bucket exists (runs once at startup, non-fatal)
async function ensureVideoBucket(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (buckets?.some(b => b.name === VIDEO_BUCKET)) return;
  const { error } = await supabaseAdmin.storage.createBucket(VIDEO_BUCKET, { public: true });
  if (error) console.error('[upload] failed to create bucket:', error.message);
  else console.log(`[upload] bucket "${VIDEO_BUCKET}" created`);
}
void ensureVideoBucket();

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload/post-video
// Recebe vídeo via multipart, comprime com ffmpeg (720p, CRF 28) e salva no
// bucket workout-videos. Retorna { url }.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/post-video',
  requireAuth,
  uploadVideoSingle('video'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum vídeo enviado.' });
      return;
    }

    const userId = req.userId!;
    const id     = randomUUID();
    const path   = `${userId}/${id}.mp4`;

    let compressed: Buffer;
    try {
      compressed = await compressVideo(req.file.buffer);
    } catch (err) {
      console.error('[upload] compressVideo error:', err);
      res.status(422).json({ error: 'Não foi possível processar o vídeo.' });
      return;
    }

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(path, compressed, { contentType: 'video/mp4', upsert: false });

    if (uploadErr) {
      console.error('[upload] video storage error:', uploadErr);
      res.status(500).json({ error: 'Falha ao salvar vídeo no storage.' });
      return;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from(VIDEO_BUCKET).getPublicUrl(path);
    res.status(201).json({ url: publicUrl });
  },
);

export default router;
