import multer, { MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — matches frontend validation

const _multer = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG ou WebP.'));
    }
  },
});

/** Wraps multer.single() so errors become JSON 400 responses instead of HTML 500. */
export function uploadSingle(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    _multer.single(field)(req, res, (err: unknown) => {
      if (!err) { next(); return; }
      if (err instanceof MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? `Arquivo muito grande. Máximo ${MAX_SIZE_BYTES / 1024 / 1024} MB.`
          : err.message;
        res.status(400).json({ error: msg });
      } else {
        res.status(400).json({ error: (err as Error).message ?? 'Erro no upload.' });
      }
    });
  };
}
