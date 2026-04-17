import { AiNotImplementedError } from '../errors';

export async function buildFleetCatalogContext(_tenantId: string): Promise<string> {
  throw new AiNotImplementedError('buildFleetCatalogContext');
}
