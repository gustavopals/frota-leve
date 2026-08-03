import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { ValidationError } from '../shared/errors';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UPLOAD_DIRECTORY = path.resolve(process.cwd(), 'uploads/mobile');

fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIRECTORY),
  filename: (_req, file, callback) => {
    const extensionByMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    callback(null, `${randomUUID()}${extensionByMime[file.mimetype] ?? ''}`);
  },
});

export const mobileUpload = multer({
  storage,
  limits: { files: 1, fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new ValidationError('Envie uma imagem JPG, PNG ou WEBP'));
      return;
    }
    callback(null, true);
  },
}).single('file');
