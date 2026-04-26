import { AiNotImplementedError } from '../errors';

export class ReportService {
  async generateMonthly(): Promise<never> {
    throw new AiNotImplementedError('ReportService.generateMonthly');
  }
}

export const reportService = new ReportService();
