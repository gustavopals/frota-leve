import { AiNotImplementedError } from '../errors';

export async function buildVehicleDossierContext(
  _tenantId: string,
  _vehicleId: string,
): Promise<string> {
  throw new AiNotImplementedError('buildVehicleDossierContext');
}
