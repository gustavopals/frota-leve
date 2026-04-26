import { AiNotImplementedError } from '../errors';

export class OcrService {
  async extract(): Promise<never> {
    throw new AiNotImplementedError('OcrService.extract');
  }
}

export const ocrService = new OcrService();
