import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { env } from '../configs/env.js';
mkdirSync(env.UPLOAD_TEMP_DIR, { recursive: true, mode: 0o700 });
const storage = multer.diskStorage({ destination: env.UPLOAD_TEMP_DIR, filename: (_req, _file, done) => done(null, randomUUID()) });
export const upload = kind => (req, res, next) => {
  const parser = multer({ storage, limits: { fileSize: (kind === 'book' ? env.MAX_BOOK_SIZE_MB : env.MAX_SAMPLE_PAPER_SIZE_MB) * 1024 * 1024, files: 1, fields: 12, fieldSize: 4096, parts: 14 } }).single('file');
  parser(req, res, error => {
    if (req.file) { const cleanup = () => unlink(req.file.path).catch(() => {}); res.once('finish', cleanup); res.once('close', cleanup); }
    next(error);
  });
};
