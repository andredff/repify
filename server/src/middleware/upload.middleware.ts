import multer, { MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

const _multerImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG ou WebP.'));
  },
});

const _multerVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_VIDEO_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Formato de vídeo não suportado. Use MP4, WebM ou MOV.'));
  },
});

function wrapMulter(instance: ReturnType<typeof multer>, field: string, maxMb: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    instance.single(field)(req, res, (err: unknown) => {
      if (!err) { next(); return; }
      if (err instanceof MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? `Arquivo muito grande. Máximo ${maxMb} MB.`
          : err.message;
        res.status(400).json({ error: msg });
      } else {
        res.status(400).json({ error: (err as Error).message ?? 'Erro no upload.' });
      }
    });
  };
}

export const uploadSingle      = (field: string) => wrapMulter(_multerImage, field, MAX_IMAGE_BYTES / 1024 / 1024);
export const uploadVideoSingle = (field: string) => wrapMulter(_multerVideo, field, MAX_VIDEO_BYTES / 1024 / 1024);
