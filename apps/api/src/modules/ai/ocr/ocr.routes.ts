import { Router } from 'express';
import { aiRateLimiter } from '../../../middlewares/ai-rate-limiter';
import { imageUpload } from '../../../middlewares/upload';
import { OcrController } from './ocr.controller';

const controller = new OcrController();

/**
 * Rotas de OCR (TASK 3.6.3). Montado dentro do `aiRouter`, portanto já assume
 * autenticação, tenant, feature flag e plano IA validados.
 *
 * A imagem trafega em memória (multer memoryStorage) e não é persistida.
 */
export const ocrRouter = Router();

ocrRouter.post('/fuel', aiRateLimiter('ocr'), imageUpload, controller.extractFuel);

ocrRouter.post('/invoice', aiRateLimiter('ocr'), imageUpload, controller.extractInvoice);
