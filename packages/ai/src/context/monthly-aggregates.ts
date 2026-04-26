import { AiNotImplementedError } from '../errors';

export async function buildMonthlyAggregatesContext(
  _tenantId: string,
  _period: string,
): Promise<string> {
  throw new AiNotImplementedError('buildMonthlyAggregatesContext');
}
