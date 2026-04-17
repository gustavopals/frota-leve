import { AiNotImplementedError } from '../errors';

export class AnomalyService {
  async detect(): Promise<never> {
    throw new AiNotImplementedError('AnomalyService.detect');
  }
}

export const anomalyService = new AnomalyService();
