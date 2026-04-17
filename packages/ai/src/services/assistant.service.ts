import { AiNotImplementedError } from '../errors';

export class AssistantService {
  async reply(): Promise<never> {
    throw new AiNotImplementedError('AssistantService.reply');
  }
}

export const assistantService = new AssistantService();
