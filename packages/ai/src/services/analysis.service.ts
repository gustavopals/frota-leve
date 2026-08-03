import { AiNotImplementedError } from '../errors';

export class AnalysisService {
  async analyzeVehicle(): Promise<never> {
    throw new AiNotImplementedError('AnalysisService.analyzeVehicle');
  }
}

export const analysisService = new AnalysisService();
