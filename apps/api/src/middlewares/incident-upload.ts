import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { ValidationError } from '../shared/errors';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB por arquivo
const MAX_FILES = 20;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_MIME_TYPES = new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]);
const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|pdf|doc|docx)$/i;

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'incidents');

// Cria o diretório de uploads se não existir
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `incident-${uniqueSuffix}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.test(file.originalname);

  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        'Tipo de arquivo não permitido. Envie imagens (JPG, PNG, WEBP) ou documentos (PDF, DOC, DOCX).',
      ),
    );
  }
}

export const incidentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES,
  },
}).array('files', MAX_FILES);
