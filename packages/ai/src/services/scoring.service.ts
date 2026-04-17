import { AiNotImplementedError } from '../errors';

export class ScoringService {
  async compute(): Promise<never> {
    throw new AiNotImplementedError('ScoringService.compute');
  }
}

export const scoringService = new ScoringService();
