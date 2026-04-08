import multer from 'multer';
import { ValidationError } from '../shared/errors';

const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', // alguns clientes enviam CSV como text/plain
]);

const ALLOWED_EXTENSIONS = /\.(csv|xls|xlsx)$/i;

const storage = multer.memoryStorage();

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
    cb(new ValidationError('Formato de arquivo inválido. Envie um arquivo CSV ou XLSX.'));
  }
}

export const spreadsheetUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('file');
