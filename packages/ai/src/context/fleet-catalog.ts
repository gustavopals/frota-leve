import {
  ServiceOrderStatus,
  type FuelType,
  prisma,
  type VehicleCategory,
  type VehicleStatus,
} from '@frota-leve/database';

type CountRow<TKey extends string> = {
  [key in TKey]: string;
} & {
  _count: { _all: number };
};

function currentMonthRange(referenceDate = new Date()): { period: string; start: Date; end: Date } {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

  return {
    period: `${year.toString().padStart(4, '0')}-${(month + 1).toString().padStart(2, '0')}`,
    start,
    end,
  };
}

function formatCountMap<TKey extends string>(
  rows: CountRow<TKey>[],
  key: TKey,
): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[String(row[key])] = row._count._all;
    return acc;
  }, {});
}

/**
 * Monta um contexto compacto e cacheável da frota do tenant.
 * Não inclui CPF, CNH, telefone ou e-mail; dados detalhados são buscados apenas via tools.
 */
export async function buildFleetCatalogContext(tenantId: string): Promise<string> {
  const month = currentMonthRange();

  const [
    tenant,
    totalVehicles,
    activeDrivers,
    vehiclesByStatus,
    vehiclesByCategory,
    vehiclesByFuelType,
    openServiceOrders,
    fuelByVehicle,
    maintenanceByVehicle,
    openAnomalies,
  ] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, plan: true },
    }),
    prisma.vehicle.count({ where: { tenantId } }),
    prisma.driver.count({ where: { tenantId, isActive: true } }),
    prisma.vehicle.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.vehicle.groupBy({
      by: ['category'],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.vehicle.groupBy({
      by: ['fuelType'],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.serviceOrder.count({
      where: {
        tenantId,
        status: { in: [ServiceOrderStatus.OPEN, ServiceOrderStatus.IN_PROGRESS] },
      },
    }),
    prisma.fuelRecord.groupBy({
      by: ['vehicleId'],
      where: { tenantId, date: { gte: month.start, lt: month.end } },
      _sum: { totalCost: true },
    }),
    prisma.serviceOrder.groupBy({
      by: ['vehicleId'],
      where: { tenantId, createdAt: { gte: month.start, lt: month.end } },
      _sum: { totalCost: true },
    }),
    prisma.aIAnomaly.count({ where: { tenantId, status: 'OPEN' } }),
  ]);

  const costByVehicle = new Map<string, { fuelCost: number; maintenanceCost: number }>();

  for (const row of fuelByVehicle) {
    costByVehicle.set(row.vehicleId, {
      fuelCost: row._sum.totalCost ?? 0,
      maintenanceCost: 0,
    });
  }

  for (const row of maintenanceByVehicle) {
    const current = costByVehicle.get(row.vehicleId) ?? { fuelCost: 0, maintenanceCost: 0 };
    current.maintenanceCost = row._sum.totalCost ?? 0;
    costByVehicle.set(row.vehicleId, current);
  }

  const topVehicleCosts = Array.from(costByVehicle.entries())
    .map(([vehicleId, costs]) => ({
      vehicleId,
      fuelCost: costs.fuelCost,
      maintenanceCost: costs.maintenanceCost,
      totalCost: costs.fuelCost + costs.maintenanceCost,
    }))
    .sort((left, right) => right.totalCost - left.totalCost)
    .slice(0, 10);

  const topVehicles =
    topVehicleCosts.length > 0
      ? await prisma.vehicle.findMany({
          where: { tenantId, id: { in: topVehicleCosts.map((item) => item.vehicleId) } },
          select: { id: true, plate: true, brand: true, model: true, category: true },
        })
      : [];

  const vehicleById = new Map(topVehicles.map((vehicle) => [vehicle.id, vehicle]));
  const topCostVehicles = topVehicleCosts.map((item) => ({
    vehicle: vehicleById.get(item.vehicleId) ?? { id: item.vehicleId, plate: 'N/A' },
    fuelCost: item.fuelCost,
    maintenanceCost: item.maintenanceCost,
    totalCost: item.totalCost,
  }));

  return JSON.stringify(
    {
      contextKind: 'fleetCatalog',
      tenant: {
        name: tenant?.name ?? 'Tenant desconhecido',
        plan: tenant?.plan ?? null,
      },
      period: month.period,
      summary: {
        totalVehicles,
        activeDrivers,
        openServiceOrders,
        openAnomalies,
        vehiclesByStatus: formatCountMap(
          vehiclesByStatus as CountRow<'status'>[],
          'status',
        ) satisfies Partial<Record<VehicleStatus, number>>,
        vehiclesByCategory: formatCountMap(
          vehiclesByCategory as CountRow<'category'>[],
          'category',
        ) satisfies Partial<Record<VehicleCategory, number>>,
        vehiclesByFuelType: formatCountMap(
          vehiclesByFuelType as CountRow<'fuelType'>[],
          'fuelType',
        ) satisfies Partial<Record<FuelType, number>>,
      },
      topCostVehicles,
    },
    null,
    2,
  );
}
