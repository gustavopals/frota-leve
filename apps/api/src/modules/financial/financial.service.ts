import {
  FineStatus,
  ServiceOrderStatus,
  type Prisma,
  type FineStatus as DatabaseFineStatus,
  type ServiceOrderStatus as DatabaseServiceOrderStatus,
} from '@frota-leve/database';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import type {
  FinancialActorContext,
  FinancialComparisonResponse,
  FinancialComparisonVehicle,
  FinancialOverviewMonthlyItem,
  FinancialOverviewResponse,
  FinancialTcoComponents,
  FinancialTcoResponse,
  FinancialVehicleInfo,
} from './financial.types';
import type {
  FinancialComparisonQueryInput,
  FinancialOverviewQueryInput,
  FinancialTcoQueryInput,
} from './financial.validators';

const DEFAULT_MONTH_WINDOW = 6;
const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

type FinancialVehicleRecord = Prisma.VehicleGetPayload<{
  select: {
    id: true;
    plate: true;
    brand: true;
    model: true;
    year: true;
    currentMileage: true;
    acquisitionValue: true;
  };
}>;

type FuelCostRecord = Prisma.FuelRecordGetPayload<{
  select: {
    vehicleId: true;
    date: true;
    totalCost: true;
  };
}>;

type MaintenanceCostRecord = Prisma.ServiceOrderGetPayload<{
  select: {
    vehicleId: true;
    status: true;
    totalCost: true;
    startDate: true;
    endDate: true;
    createdAt: true;
  };
}>;

type TireCostRecord = Prisma.TireGetPayload<{
  select: {
    currentVehicleId: true;
    costNew: true;
    costRetreat: true;
    retreatCount: true;
    createdAt: true;
  };
}>;

type FineCostRecord = Prisma.FineGetPayload<{
  select: {
    vehicleId: true;
    status: true;
    amount: true;
    updatedAt: true;
  };
}>;

type DocumentCostRecord = Prisma.DocumentGetPayload<{
  select: {
    vehicleId: true;
    cost: true;
    createdAt: true;
    status: true;
  };
}>;

function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

function sumNumbers(values: number[]): number {
  return roundToTwoDecimals(values.reduce((sum, value) => sum + value, 0));
}

function calculateTireInvestment(
  tire: Pick<TireCostRecord, 'costNew' | 'costRetreat' | 'retreatCount'>,
) {
  return roundToTwoDecimals(tire.costNew + tire.costRetreat * tire.retreatCount);
}

function calculateCostPerKm(totalCost: number, mileage: number): number | null {
  if (mileage <= 0) return null;
  return roundToTwoDecimals(totalCost / mileage);
}

function toVehicleInfo(vehicle: FinancialVehicleRecord): FinancialVehicleInfo {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    currentMileage: vehicle.currentMileage,
    acquisitionValue: vehicle.acquisitionValue,
  };
}

function getMonthKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTH_LABELS[Number(month) - 1]}/${year}`;
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addUtcMonths(value: Date, months: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function resolveMonthlyRange(query: FinancialOverviewQueryInput): { start: Date; end: Date } {
  if (query.dateFrom && query.dateTo) {
    return {
      start: startOfUtcMonth(query.dateFrom),
      end: startOfUtcMonth(query.dateTo),
    };
  }

  if (query.dateFrom) {
    return {
      start: startOfUtcMonth(query.dateFrom),
      end: startOfUtcMonth(new Date()),
    };
  }

  if (query.dateTo) {
    const end = startOfUtcMonth(query.dateTo);
    return {
      start: addUtcMonths(end, -(DEFAULT_MONTH_WINDOW - 1)),
      end,
    };
  }

  const end = startOfUtcMonth(new Date());
  return {
    start: addUtcMonths(end, -(DEFAULT_MONTH_WINDOW - 1)),
    end,
  };
}

function enumerateMonthKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let cursor = startOfUtcMonth(start);
  const last = startOfUtcMonth(end);

  while (cursor <= last) {
    keys.push(getMonthKey(cursor));
    cursor = addUtcMonths(cursor, 1);
  }

  return keys;
}

function isWithinMonthlyRange(value: Date, start: Date, end: Date): boolean {
  const month = startOfUtcMonth(value);
  return month >= startOfUtcMonth(start) && month <= startOfUtcMonth(end);
}

function toDatabaseFineStatus(value: FineStatus): DatabaseFineStatus {
  return value as unknown as DatabaseFineStatus;
}

function toDatabaseServiceOrderStatus(value: ServiceOrderStatus): DatabaseServiceOrderStatus {
  return value as unknown as DatabaseServiceOrderStatus;
}

function computeOperationalComponents(params: {
  vehicleId: string;
  fuelRecords: FuelCostRecord[];
  serviceOrders: MaintenanceCostRecord[];
  tires: TireCostRecord[];
  fines: FineCostRecord[];
  documents: DocumentCostRecord[];
}): Omit<FinancialTcoComponents, 'depreciation'> {
  const { vehicleId, fuelRecords, serviceOrders, tires, fines, documents } = params;

  const fuel = sumNumbers(
    fuelRecords.filter((item) => item.vehicleId === vehicleId).map((item) => item.totalCost),
  );

  const maintenance = sumNumbers(
    serviceOrders
      .filter(
        (item) =>
          item.vehicleId === vehicleId &&
          item.status === toDatabaseServiceOrderStatus(ServiceOrderStatus.COMPLETED),
      )
      .map((item) => item.totalCost),
  );

  const tireRecords = tires.filter((item) => item.currentVehicleId === vehicleId);
  const tireCost = sumNumbers(tireRecords.map((item) => calculateTireInvestment(item)));

  const fineCost = sumNumbers(
    fines
      .filter(
        (item) =>
          item.vehicleId === vehicleId && item.status === toDatabaseFineStatus(FineStatus.PAID),
      )
      .map((item) => item.amount),
  );

  const documentCost = sumNumbers(
    documents.filter((item) => item.vehicleId === vehicleId).map((item) => item.cost ?? 0),
  );

  return {
    fuel,
    maintenance,
    tires: tireCost,
    fines: fineCost,
    documents: documentCost,
  };
}

function getMaintenanceReferenceDate(item: MaintenanceCostRecord): Date {
  return item.endDate ?? item.startDate ?? item.createdAt;
}

function createEmptyOverviewMonth(
  period: string,
  budget: number | null,
): FinancialOverviewMonthlyItem {
  return {
    period,
    label: getMonthLabel(period),
    fuel: 0,
    maintenance: 0,
    tires: 0,
    fines: 0,
    documents: 0,
    total: 0,
    budget,
    variance: budget != null ? -budget : null,
  };
}

function finalizeOverviewMonth(
  month: Omit<FinancialOverviewMonthlyItem, 'variance'> & { variance: number | null },
): FinancialOverviewMonthlyItem {
  const total = roundToTwoDecimals(
    month.fuel + month.maintenance + month.tires + month.fines + month.documents,
  );
  const variance = month.budget != null ? roundToTwoDecimals(total - month.budget) : null;

  return {
    ...month,
    total,
    variance,
  };
}

export class FinancialService {
  private readonly tireAllocationWarning =
    'Custos de pneus são atribuídos pela alocação atual do pneu, pois não há histórico financeiro por movimentação.';

  async getVehicleTco(
    context: FinancialActorContext,
    vehicleId: string,
    query: FinancialTcoQueryInput,
  ): Promise<FinancialTcoResponse> {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId: context.tenantId },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        year: true,
        currentMileage: true,
        acquisitionValue: true,
      },
    });

    if (!vehicle) throw new NotFoundError('Veículo não encontrado');

    const [fuelRecords, serviceOrders, tires, fines, documents] = await Promise.all([
      prisma.fuelRecord.findMany({
        where: { tenantId: context.tenantId, vehicleId },
        select: { vehicleId: true, date: true, totalCost: true },
      }),
      prisma.serviceOrder.findMany({
        where: { tenantId: context.tenantId, vehicleId },
        select: {
          vehicleId: true,
          status: true,
          totalCost: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
      }),
      prisma.tire.findMany({
        where: { tenantId: context.tenantId, currentVehicleId: vehicleId },
        select: {
          currentVehicleId: true,
          costNew: true,
          costRetreat: true,
          retreatCount: true,
          createdAt: true,
        },
      }),
      prisma.fine.findMany({
        where: {
          tenantId: context.tenantId,
          vehicleId,
          status: toDatabaseFineStatus(FineStatus.PAID),
        },
        select: { vehicleId: true, status: true, amount: true, updatedAt: true },
      }),
      prisma.document.findMany({
        where: { tenantId: context.tenantId, vehicleId },
        select: { vehicleId: true, cost: true, createdAt: true, status: true },
      }),
    ]);

    const components = computeOperationalComponents({
      vehicleId,
      fuelRecords,
      serviceOrders,
      tires,
      fines,
      documents,
    });

    const operational = sumNumbers(Object.values(components));
    const acquisitionValue = vehicle.acquisitionValue;
    const currentMarketValue = query.currentMarketValue;
    const hasDepreciationInputs =
      acquisitionValue != null && typeof currentMarketValue === 'number';
    const depreciation = hasDepreciationInputs
      ? roundToTwoDecimals(Math.max(acquisitionValue - currentMarketValue, 0))
      : null;
    const tco = roundToTwoDecimals(operational + (depreciation ?? 0));

    const warnings = [this.tireAllocationWarning];
    if (!hasDepreciationInputs) {
      warnings.push(
        'Depreciação não foi incluída porque o valor atual de mercado/FIPE não foi informado.',
      );
    }

    return {
      vehicle: toVehicleInfo(vehicle),
      components: {
        ...components,
        depreciation,
      },
      totals: {
        operational,
        tco,
        costPerKm: calculateCostPerKm(tco, vehicle.currentMileage),
      },
      depreciation: {
        acquisitionValue: vehicle.acquisitionValue,
        currentMarketValue: query.currentMarketValue ?? null,
        amount: depreciation,
        included: depreciation != null,
      },
      warnings,
    };
  }

  async getOverview(
    context: FinancialActorContext,
    query: FinancialOverviewQueryInput,
  ): Promise<FinancialOverviewResponse> {
    const [vehicleCount, fuelRecords, serviceOrders, tires, fines, documents] = await Promise.all([
      prisma.vehicle.count({ where: { tenantId: context.tenantId } }),
      prisma.fuelRecord.findMany({
        where: { tenantId: context.tenantId },
        select: { vehicleId: true, date: true, totalCost: true },
      }),
      prisma.serviceOrder.findMany({
        where: { tenantId: context.tenantId },
        select: {
          vehicleId: true,
          status: true,
          totalCost: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
      }),
      prisma.tire.findMany({
        where: { tenantId: context.tenantId, currentVehicleId: { not: null } },
        select: {
          currentVehicleId: true,
          costNew: true,
          costRetreat: true,
          retreatCount: true,
          createdAt: true,
        },
      }),
      prisma.fine.findMany({
        where: { tenantId: context.tenantId, status: toDatabaseFineStatus(FineStatus.PAID) },
        select: { vehicleId: true, status: true, amount: true, updatedAt: true },
      }),
      prisma.document.findMany({
        where: { tenantId: context.tenantId, vehicleId: { not: null } },
        select: { vehicleId: true, cost: true, createdAt: true, status: true },
      }),
    ]);

    const { start, end } = resolveMonthlyRange(query);
    const monthKeys = enumerateMonthKeys(start, end);
    const budgetValue = query.monthlyBudget ?? null;
    const monthMap = new Map<string, FinancialOverviewMonthlyItem>(
      monthKeys.map((key) => [key, createEmptyOverviewMonth(key, budgetValue)]),
    );

    for (const record of fuelRecords) {
      if (!isWithinMonthlyRange(record.date, start, end)) continue;
      const month = monthMap.get(getMonthKey(record.date));
      if (!month) continue;
      month.fuel = roundToTwoDecimals(month.fuel + record.totalCost);
    }

    for (const record of serviceOrders) {
      if (record.status !== toDatabaseServiceOrderStatus(ServiceOrderStatus.COMPLETED)) continue;
      const date = getMaintenanceReferenceDate(record);
      if (!isWithinMonthlyRange(date, start, end)) continue;
      const month = monthMap.get(getMonthKey(date));
      if (!month) continue;
      month.maintenance = roundToTwoDecimals(month.maintenance + record.totalCost);
    }

    for (const record of tires) {
      if (!record.currentVehicleId) continue;
      if (!isWithinMonthlyRange(record.createdAt, start, end)) continue;
      const month = monthMap.get(getMonthKey(record.createdAt));
      if (!month) continue;
      month.tires = roundToTwoDecimals(month.tires + calculateTireInvestment(record));
    }

    for (const record of fines) {
      if (!isWithinMonthlyRange(record.updatedAt, start, end)) continue;
      const month = monthMap.get(getMonthKey(record.updatedAt));
      if (!month) continue;
      month.fines = roundToTwoDecimals(month.fines + record.amount);
    }

    for (const record of documents) {
      if (!isWithinMonthlyRange(record.createdAt, start, end)) continue;
      const month = monthMap.get(getMonthKey(record.createdAt));
      if (!month) continue;
      month.documents = roundToTwoDecimals(month.documents + (record.cost ?? 0));
    }

    const monthly = monthKeys.map((key) => {
      const month = monthMap.get(key);

      if (!month) {
        throw new Error(`Overview month ${key} should have been initialized.`);
      }

      return finalizeOverviewMonth(month);
    });

    const summary = monthly.reduce(
      (acc, item) => ({
        fuel: roundToTwoDecimals(acc.fuel + item.fuel),
        maintenance: roundToTwoDecimals(acc.maintenance + item.maintenance),
        tires: roundToTwoDecimals(acc.tires + item.tires),
        fines: roundToTwoDecimals(acc.fines + item.fines),
        documents: roundToTwoDecimals(acc.documents + item.documents),
        total: roundToTwoDecimals(acc.total + item.total),
      }),
      { fuel: 0, maintenance: 0, tires: 0, fines: 0, documents: 0, total: 0 },
    );

    const budgetConfigured = budgetValue != null;
    const totalBudget = budgetConfigured ? roundToTwoDecimals(budgetValue * monthly.length) : null;
    const variance = totalBudget != null ? roundToTwoDecimals(summary.total - totalBudget) : null;
    const variancePercent =
      totalBudget && totalBudget > 0
        ? roundToTwoDecimals((summary.total / totalBudget - 1) * 100)
        : null;

    const warnings = [this.tireAllocationWarning];
    if (!budgetConfigured) {
      warnings.push(
        'Budget vs realizado depende do parâmetro opcional `monthlyBudget`, pois ainda não existe orçamento persistido no sistema.',
      );
    }

    return {
      summary: {
        ...summary,
        vehicles: vehicleCount,
        dateFrom: start,
        dateTo: end,
      },
      monthly,
      budget: {
        configured: budgetConfigured,
        monthlyBudget: budgetValue,
        totalBudget,
        realized: summary.total,
        variance,
        variancePercent,
      },
      warnings,
    };
  }

  async getComparison(
    context: FinancialActorContext,
    query: FinancialComparisonQueryInput,
  ): Promise<FinancialComparisonResponse> {
    const referenceVehicle = await prisma.vehicle.findFirst({
      where: { id: query.vehicleId, tenantId: context.tenantId },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        year: true,
        currentMileage: true,
        acquisitionValue: true,
      },
    });

    if (!referenceVehicle) throw new NotFoundError('Veículo não encontrado');

    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: context.tenantId,
        brand: referenceVehicle.brand,
        model: referenceVehicle.model,
        year: referenceVehicle.year,
      },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        year: true,
        currentMileage: true,
        acquisitionValue: true,
      },
      orderBy: { plate: 'asc' },
    });

    const vehicleIds = vehicles.map((vehicle) => vehicle.id);

    const [fuelRecords, serviceOrders, tires, fines, documents] = await Promise.all([
      prisma.fuelRecord.findMany({
        where: { tenantId: context.tenantId, vehicleId: { in: vehicleIds } },
        select: { vehicleId: true, date: true, totalCost: true },
      }),
      prisma.serviceOrder.findMany({
        where: { tenantId: context.tenantId, vehicleId: { in: vehicleIds } },
        select: {
          vehicleId: true,
          status: true,
          totalCost: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
      }),
      prisma.tire.findMany({
        where: { tenantId: context.tenantId, currentVehicleId: { in: vehicleIds } },
        select: {
          currentVehicleId: true,
          costNew: true,
          costRetreat: true,
          retreatCount: true,
          createdAt: true,
        },
      }),
      prisma.fine.findMany({
        where: {
          tenantId: context.tenantId,
          vehicleId: { in: vehicleIds },
          status: toDatabaseFineStatus(FineStatus.PAID),
        },
        select: { vehicleId: true, status: true, amount: true, updatedAt: true },
      }),
      prisma.document.findMany({
        where: { tenantId: context.tenantId, vehicleId: { in: vehicleIds } },
        select: { vehicleId: true, cost: true, createdAt: true, status: true },
      }),
    ]);

    const comparisonRows: FinancialComparisonVehicle[] = vehicles.map((vehicle) => {
      const components = computeOperationalComponents({
        vehicleId: vehicle.id,
        fuelRecords,
        serviceOrders,
        tires,
        fines,
        documents,
      });

      const operational = sumNumbers(Object.values(components));

      return {
        vehicle: toVehicleInfo(vehicle),
        components,
        totals: {
          operational,
          costPerKm: calculateCostPerKm(operational, vehicle.currentMileage),
        },
      };
    });

    const sortedByCostPerKm = [...comparisonRows].sort((a, b) => {
      if (a.totals.costPerKm == null && b.totals.costPerKm == null) return 0;
      if (a.totals.costPerKm == null) return 1;
      if (b.totals.costPerKm == null) return -1;
      return b.totals.costPerKm - a.totals.costPerKm;
    });

    const reference = comparisonRows.find((item) => item.vehicle.id === referenceVehicle.id);

    if (!reference) {
      throw new NotFoundError('Veículo de referência não encontrado na base comparável');
    }

    const similarVehicles = sortedByCostPerKm
      .filter((item) => item.vehicle.id !== referenceVehicle.id)
      .slice(0, query.limit);

    const comparableRows = comparisonRows.filter((item) => item.totals.costPerKm != null);
    const averageOperational =
      comparisonRows.length > 0
        ? roundToTwoDecimals(
            comparisonRows.reduce((sum, item) => sum + item.totals.operational, 0) /
              comparisonRows.length,
          )
        : 0;
    const averageCostPerKm =
      comparableRows.length > 0
        ? roundToTwoDecimals(
            comparableRows.reduce((sum, item) => sum + (item.totals.costPerKm ?? 0), 0) /
              comparableRows.length,
          )
        : null;
    const referenceRankByCostPerKm =
      reference.totals.costPerKm == null
        ? null
        : sortedByCostPerKm.findIndex((item) => item.vehicle.id === reference.vehicle.id) + 1;

    return {
      referenceVehicle: reference,
      similarVehicles,
      benchmark: {
        vehicleCount: comparisonRows.length,
        averageOperational,
        averageCostPerKm,
        referenceRankByCostPerKm,
      },
      comparisonKey: {
        brand: referenceVehicle.brand,
        model: referenceVehicle.model,
        year: referenceVehicle.year,
      },
      warnings: [
        this.tireAllocationWarning,
        'Comparativo usa custo operacional conhecido; depreciação não entra porque o valor atual de mercado/FIPE não está persistido por veículo.',
      ],
    };
  }
}

export const financialService = new FinancialService();
