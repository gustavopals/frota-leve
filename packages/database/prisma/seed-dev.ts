/* eslint-disable no-console -- seed script intentionally reports progress in the terminal */

import {
  PrismaClient,
  PlanType,
  TenantStatus,
  UserRole,
  FuelType,
  VehicleCategory,
  VehicleStatus,
  DocumentType,
  DocumentStatus,
  MaintenanceType,
  FineSeverity,
  ChecklistExecutionStatus,
  ChecklistItemStatus,
  NotificationType,
  TireStatus,
} from '@prisma/client';
import type { FineStatus, IncidentStatus, IncidentType, ServiceOrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function randomDate(startDaysAgo: number, endDaysAgo: number): Date {
  const start = daysAgo(startDaysAgo);
  const end = daysAgo(endDaysAgo);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function ensureDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }

  return value;
}

// ─── Dados brasileiros realistas ────────────────────────────────────────────

const POSTOS = [
  'Posto Shell Centro',
  'Posto Ipiranga BR-116',
  'Posto Petrobras Batel',
  'Auto Posto Curitibano',
  'Posto Ale Pinhais',
  'Rede DislubNorte',
  'Posto BR Colombo',
  'Shell Select Juvevê',
];

const OFICINAS = [
  'Mecânica do Paulo',
  'AutoCenter Express',
  'Oficina Brasil Curitiba',
  'Centro Automotivo Premium',
  'Retífica Curitiba',
  'Borracharia Central',
  'Funilaria & Pintura 3 Irmãos',
  'Elétrica Automotiva JR',
];

const RUAS_CURITIBA = [
  'Rua XV de Novembro, 1200',
  'Av. Marechal Deodoro, 630',
  'BR-116 km 98',
  'Av. Comendador Franco, 4500',
  'Rua Padre Anchieta, 2300',
  'Rod. dos Minérios, km 5',
  'Av. Sete de Setembro, 3200',
  'Rua João Gualberto, 1800',
  'Av. República Argentina, 4700',
  'Rua Marechal Floriano, 500',
];

const MARCAS_PNEU = ['Pirelli', 'Michelin', 'Continental', 'Bridgestone', 'Goodyear', 'Firestone'];
const MODELOS_PNEU = [
  'Scorpion ATR',
  'Primacy 4',
  'PowerContact 2',
  'Turanza EL400',
  'EfficientGrip',
  'Destination LE',
];

// ─── Main seed ──────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed de desenvolvimento...\n');

  // Limpar dados existentes (ordem reversa de dependências)
  console.log('🗑️  Limpando dados existentes...');
  await prisma.tireInspection.deleteMany();
  await prisma.tire.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.checklistExecutionItem.deleteMany();
  await prisma.checklistExecution.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.fine.deleteMany();
  await prisma.document.deleteMany();
  await prisma.serviceOrderItem.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.maintenancePlan.deleteMany();
  await prisma.fuelRecord.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const passwordHash = await bcrypt.hash('123456', 10);

  // ─── Tenant ────────────────────────────────────────────────────────────────

  console.log('🏢 Criando tenants...');

  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Transportadora Demo Ltda',
      tradeName: 'Transportadora Demo',
      cnpj: '12345678000199',
      email: 'contato@demo.com',
      phone: '(41) 99999-0000',
      plan: PlanType.PROFESSIONAL,
      status: TenantStatus.ACTIVE,
      trialEndsAt: null,
      address: {
        street: 'Rua das Frotas',
        number: '123',
        neighborhood: 'Centro',
        city: 'Curitiba',
        state: 'PR',
        zipCode: '80000-000',
      },
      settings: { locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'Logística Rápida ME',
      tradeName: 'Logística Rápida',
      cnpj: '98765432000188',
      email: 'contato@lograpida.com',
      phone: '(41) 98888-1111',
      plan: PlanType.ESSENTIAL,
      status: TenantStatus.TRIAL,
      trialEndsAt: daysFromNow(10),
      address: {
        street: 'Av. das Indústrias',
        number: '456',
        neighborhood: 'CIC',
        city: 'Curitiba',
        state: 'PR',
        zipCode: '81000-000',
      },
      settings: { locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
    },
  });

  // ─── Usuários ──────────────────────────────────────────────────────────────

  console.log('👥 Criando usuários...');

  const usersData = [
    {
      tenantId: tenant1.id,
      email: 'admin@demo.com',
      name: 'Carlos Administrador',
      role: UserRole.OWNER,
    },
    {
      tenantId: tenant1.id,
      email: 'gestor@demo.com',
      name: 'Maria Gestora',
      role: UserRole.MANAGER,
    },
    {
      tenantId: tenant1.id,
      email: 'financeiro@demo.com',
      name: 'Ana Financeira',
      role: UserRole.FINANCIAL,
    },
    {
      tenantId: tenant1.id,
      email: 'motorista1@demo.com',
      name: 'João Silva',
      role: UserRole.DRIVER,
    },
    {
      tenantId: tenant1.id,
      email: 'motorista2@demo.com',
      name: 'Pedro Santos',
      role: UserRole.DRIVER,
    },
    {
      tenantId: tenant1.id,
      email: 'motorista3@demo.com',
      name: 'Rafael Oliveira',
      role: UserRole.DRIVER,
    },
    {
      tenantId: tenant1.id,
      email: 'motorista4@demo.com',
      name: 'Lucas Ferreira',
      role: UserRole.DRIVER,
    },
    {
      tenantId: tenant1.id,
      email: 'motorista5@demo.com',
      name: 'Bruno Costa',
      role: UserRole.DRIVER,
    },
    {
      tenantId: tenant1.id,
      email: 'viewer@demo.com',
      name: 'Fernanda Viewer',
      role: UserRole.VIEWER,
    },
    { tenantId: tenant1.id, email: 'admin2@demo.com', name: 'Roberto Admin', role: UserRole.ADMIN },
    {
      tenantId: tenant2.id,
      email: 'admin@lograpida.com',
      name: 'Patrícia Owner',
      role: UserRole.OWNER,
    },
    {
      tenantId: tenant2.id,
      email: 'motorista@lograpida.com',
      name: 'Thiago Motorista',
      role: UserRole.DRIVER,
    },
  ];

  const users = await Promise.all(
    usersData.map((u) =>
      prisma.user.create({
        data: { ...u, passwordHash, isActive: true },
      }),
    ),
  );

  const t1Users = users.filter((u) => u.tenantId === tenant1.id);
  const t1Admin = ensureDefined(
    t1Users.find((u) => u.role === 'OWNER'),
    'Usuário OWNER do tenant principal não encontrado.',
  );
  const t1Manager = ensureDefined(
    t1Users.find((u) => u.role === 'MANAGER'),
    'Usuário MANAGER do tenant principal não encontrado.',
  );
  const t1Drivers = t1Users.filter((u) => u.role === 'DRIVER');

  // ─── Motoristas (Driver profile) ──────────────────────────────────────────

  console.log('🚗 Criando motoristas...');

  const driversData = [
    {
      name: 'João Silva',
      cpf: '11111111111',
      phone: '(41) 99901-0001',
      email: 'joao@demo.com',
      cnhNumber: 'CNH00001',
      cnhCategory: 'D',
      cnhExpiration: daysFromNow(180),
      cnhPoints: 3,
      department: 'Entregas',
      score: 85,
      userId: t1Drivers[0]?.id,
    },
    {
      name: 'Pedro Santos',
      cpf: '22222222222',
      phone: '(41) 99901-0002',
      email: 'pedro@demo.com',
      cnhNumber: 'CNH00002',
      cnhCategory: 'C',
      cnhExpiration: daysFromNow(45),
      cnhPoints: 7,
      department: 'Entregas',
      score: 72,
      userId: t1Drivers[1]?.id,
    },
    {
      name: 'Rafael Oliveira',
      cpf: '33333333333',
      phone: '(41) 99901-0003',
      email: 'rafael@demo.com',
      cnhNumber: 'CNH00003',
      cnhCategory: 'E',
      cnhExpiration: daysFromNow(365),
      cnhPoints: 0,
      department: 'Pesados',
      score: 95,
      userId: t1Drivers[2]?.id,
    },
    {
      name: 'Lucas Ferreira',
      cpf: '44444444444',
      phone: '(41) 99901-0004',
      email: 'lucas@demo.com',
      cnhNumber: 'CNH00004',
      cnhCategory: 'B',
      cnhExpiration: daysAgo(15),
      cnhPoints: 12,
      department: 'Comercial',
      score: 60,
      userId: t1Drivers[3]?.id,
    },
    {
      name: 'Bruno Costa',
      cpf: '55555555555',
      phone: '(41) 99901-0005',
      email: 'bruno@demo.com',
      cnhNumber: 'CNH00005',
      cnhCategory: 'D',
      cnhExpiration: daysFromNow(90),
      cnhPoints: 5,
      department: 'Entregas',
      score: 78,
      userId: t1Drivers[4]?.id,
    },
    {
      name: 'Marcos Inativo',
      cpf: '66666666666',
      phone: '(41) 99901-0006',
      email: 'marcos@demo.com',
      cnhNumber: 'CNH00006',
      cnhCategory: 'B',
      cnhExpiration: daysAgo(60),
      cnhPoints: 20,
      department: 'Entregas',
      score: 40,
      userId: null,
    },
  ];

  const drivers = await Promise.all(
    driversData.map((d) =>
      prisma.driver.create({
        data: {
          tenantId: tenant1.id,
          name: d.name,
          cpf: d.cpf,
          phone: d.phone,
          email: d.email,
          birthDate: daysAgo(randomBetween(8000, 16000)),
          cnhNumber: d.cnhNumber,
          cnhCategory: d.cnhCategory,
          cnhExpiration: d.cnhExpiration,
          cnhPoints: d.cnhPoints,
          emergencyContact: 'Familiar',
          emergencyPhone: '(41) 98000-0000',
          department: d.department,
          isActive: d.name !== 'Marcos Inativo',
          hireDate: daysAgo(randomBetween(100, 1000)),
          score: d.score,
          userId: d.userId,
        },
      }),
    ),
  );

  const activeDrivers = drivers.filter((d) => d.isActive);

  // ─── Veículos ──────────────────────────────────────────────────────────────

  console.log('🚛 Criando veículos...');

  const vehiclesData = [
    {
      plate: 'ABC-1A23',
      brand: 'Volkswagen',
      model: 'Delivery 11.180',
      year: 2023,
      yearModel: 2024,
      fuelType: FuelType.DIESEL_S10,
      category: VehicleCategory.HEAVY,
      status: VehicleStatus.ACTIVE,
      mileage: 45000,
      expectedConsumption: 6.5,
      acquisitionValue: 280000,
      color: 'Branco',
    },
    {
      plate: 'DEF-2B34',
      brand: 'Mercedes-Benz',
      model: 'Atego 1719',
      year: 2022,
      yearModel: 2023,
      fuelType: FuelType.DIESEL,
      category: VehicleCategory.HEAVY,
      status: VehicleStatus.ACTIVE,
      mileage: 82000,
      expectedConsumption: 5.8,
      acquisitionValue: 350000,
      color: 'Branco',
    },
    {
      plate: 'GHI-3C45',
      brand: 'Fiat',
      model: 'Strada Endurance',
      year: 2024,
      yearModel: 2025,
      fuelType: FuelType.GASOLINE,
      category: VehicleCategory.LIGHT,
      status: VehicleStatus.ACTIVE,
      mileage: 12000,
      expectedConsumption: 11.5,
      acquisitionValue: 95000,
      color: 'Vermelho',
    },
    {
      plate: 'JKL-4D56',
      brand: 'Volkswagen',
      model: 'Saveiro Robust',
      year: 2023,
      yearModel: 2024,
      fuelType: FuelType.ETHANOL,
      category: VehicleCategory.LIGHT,
      status: VehicleStatus.ACTIVE,
      mileage: 28000,
      expectedConsumption: 8.2,
      acquisitionValue: 85000,
      color: 'Prata',
    },
    {
      plate: 'MNO-5E67',
      brand: 'Iveco',
      model: 'Daily 35S14',
      year: 2021,
      yearModel: 2022,
      fuelType: FuelType.DIESEL,
      category: VehicleCategory.HEAVY,
      status: VehicleStatus.MAINTENANCE,
      mileage: 120000,
      expectedConsumption: 7.0,
      acquisitionValue: 180000,
      color: 'Branco',
    },
    {
      plate: 'PQR-6F78',
      brand: 'Toyota',
      model: 'Hilux SR',
      year: 2024,
      yearModel: 2025,
      fuelType: FuelType.DIESEL_S10,
      category: VehicleCategory.LIGHT,
      status: VehicleStatus.ACTIVE,
      mileage: 8000,
      expectedConsumption: 10.0,
      acquisitionValue: 210000,
      color: 'Preto',
    },
    {
      plate: 'STU-7G89',
      brand: 'Fiat',
      model: 'Fiorino',
      year: 2022,
      yearModel: 2023,
      fuelType: FuelType.GASOLINE,
      category: VehicleCategory.LIGHT,
      status: VehicleStatus.ACTIVE,
      mileage: 55000,
      expectedConsumption: 10.5,
      acquisitionValue: 72000,
      color: 'Branco',
    },
    {
      plate: 'VWX-8H90',
      brand: 'Scania',
      model: 'R450',
      year: 2020,
      yearModel: 2021,
      fuelType: FuelType.DIESEL,
      category: VehicleCategory.HEAVY,
      status: VehicleStatus.ACTIVE,
      mileage: 320000,
      expectedConsumption: 2.8,
      acquisitionValue: 650000,
      color: 'Azul',
    },
    {
      plate: 'YZA-9I01',
      brand: 'Honda',
      model: 'CG 160 Cargo',
      year: 2024,
      yearModel: 2025,
      fuelType: FuelType.GASOLINE,
      category: VehicleCategory.MOTORCYCLE,
      status: VehicleStatus.ACTIVE,
      mileage: 5000,
      expectedConsumption: 40.0,
      acquisitionValue: 15000,
      color: 'Vermelho',
    },
    {
      plate: 'BCD-0J12',
      brand: 'Volkswagen',
      model: 'Constellation 24.280',
      year: 2019,
      yearModel: 2020,
      fuelType: FuelType.DIESEL,
      category: VehicleCategory.HEAVY,
      status: VehicleStatus.DECOMMISSIONED,
      mileage: 450000,
      expectedConsumption: 3.0,
      acquisitionValue: 420000,
      color: 'Branco',
    },
    {
      plate: 'EFG-1K23',
      brand: 'Renault',
      model: 'Master Furgão',
      year: 2023,
      yearModel: 2024,
      fuelType: FuelType.DIESEL,
      category: VehicleCategory.HEAVY,
      status: VehicleStatus.ACTIVE,
      mileage: 35000,
      expectedConsumption: 8.5,
      acquisitionValue: 160000,
      color: 'Branco',
    },
    {
      plate: 'HIJ-2L34',
      brand: 'Chevrolet',
      model: 'S10 LTZ',
      year: 2024,
      yearModel: 2025,
      fuelType: FuelType.DIESEL_S10,
      category: VehicleCategory.LIGHT,
      status: VehicleStatus.ACTIVE,
      mileage: 15000,
      expectedConsumption: 9.5,
      acquisitionValue: 230000,
      color: 'Cinza',
    },
  ];

  const vehicles = await Promise.all(
    vehiclesData.map((v, i) =>
      prisma.vehicle.create({
        data: {
          tenantId: tenant1.id,
          plate: v.plate,
          renavam: `${randomBetween(10000000000, 99999999999)}`,
          chassis: `9BW${String(i).padStart(14, '0')}`,
          brand: v.brand,
          model: v.model,
          year: v.year,
          yearModel: v.yearModel,
          color: v.color,
          fuelType: v.fuelType,
          category: v.category,
          status: v.status,
          currentMileage: v.mileage,
          expectedConsumption: v.expectedConsumption,
          acquisitionDate: daysAgo(randomBetween(60, 1500)),
          acquisitionValue: v.acquisitionValue,
          currentDriverId: i < activeDrivers.length ? t1Drivers[i]?.id : null,
        },
      }),
    ),
  );

  const activeVehicles = vehicles.filter((v) => v.status === 'ACTIVE');

  // ─── Registros de Combustível ─────────────────────────────────────────────

  console.log('⛽ Criando registros de combustível...');

  const fuelRecords = [];
  for (const vehicle of activeVehicles) {
    const numRecords = randomBetween(8, 20);
    let currentMileage = vehicle.currentMileage - numRecords * randomBetween(200, 800);
    if (currentMileage < 0) currentMileage = 1000;

    for (let i = 0; i < numRecords; i++) {
      const kmDelta = randomBetween(200, 800);
      currentMileage += kmDelta;
      const liters = randomFloat(20, 80);
      const pricePerLiter =
        vehicle.fuelType === 'DIESEL' || vehicle.fuelType === 'DIESEL_S10'
          ? randomFloat(5.5, 6.8)
          : vehicle.fuelType === 'ETHANOL'
            ? randomFloat(3.5, 4.8)
            : randomFloat(5.8, 7.2);
      const totalCost = parseFloat((liters * pricePerLiter).toFixed(2));
      const kmPerLiter = parseFloat((kmDelta / liters).toFixed(2));
      const isAnomaly = kmPerLiter < (vehicle.expectedConsumption ?? 8) * 0.6;
      const driver = randomItem(activeDrivers);

      fuelRecords.push({
        tenantId: tenant1.id,
        vehicleId: vehicle.id,
        driverId: driver.id,
        date: randomDate(180, 1),
        mileage: currentMileage,
        liters,
        pricePerLiter,
        totalCost,
        fuelType: vehicle.fuelType,
        fullTank: Math.random() > 0.15,
        gasStation: randomItem(POSTOS),
        kmPerLiter,
        anomaly: isAnomaly,
        anomalyReason: isAnomaly ? 'Consumo abaixo de 60% da média esperada' : null,
        createdByUserId: t1Admin.id,
      });
    }
  }

  await prisma.fuelRecord.createMany({ data: fuelRecords });
  console.log(`   ✅ ${fuelRecords.length} registros de combustível`);

  // ─── Planos de Manutenção ─────────────────────────────────────────────────

  console.log('🔧 Criando planos de manutenção...');

  const maintenancePlansData = [];
  const plansPerVehicle: Record<string, string[]> = {};

  for (const vehicle of activeVehicles) {
    const plans = [
      {
        name: 'Troca de óleo',
        type: MaintenanceType.PREVENTIVE,
        intervalKm: 10000,
        intervalDays: 180,
      },
      {
        name: 'Revisão de freios',
        type: MaintenanceType.PREVENTIVE,
        intervalKm: 20000,
        intervalDays: 365,
      },
      {
        name: 'Alinhamento e balanceamento',
        type: MaintenanceType.PREVENTIVE,
        intervalKm: 15000,
        intervalDays: null,
      },
      {
        name: 'Troca de filtros (ar, óleo, combustível)',
        type: MaintenanceType.PREVENTIVE,
        intervalKm: 10000,
        intervalDays: 180,
      },
    ];

    if (vehicle.category === 'HEAVY') {
      plans.push(
        {
          name: 'Revisão do sistema pneumático',
          type: MaintenanceType.PREVENTIVE,
          intervalKm: 30000,
          intervalDays: 365,
        },
        {
          name: 'Troca de lonas de freio',
          type: MaintenanceType.PREVENTIVE,
          intervalKm: 50000,
          intervalDays: null,
        },
      );
    }

    for (const plan of plans) {
      const lastExecAgo = randomBetween(30, 250);
      const nextDueDays = plan.intervalDays ? plan.intervalDays - lastExecAgo : null;
      maintenancePlansData.push({
        tenantId: tenant1.id,
        vehicleId: vehicle.id,
        name: plan.name,
        type: plan.type,
        intervalKm: plan.intervalKm,
        intervalDays: plan.intervalDays,
        lastExecutedAt: daysAgo(lastExecAgo),
        lastExecutedMileage: vehicle.currentMileage - randomBetween(2000, 15000),
        nextDueAt:
          nextDueDays !== null
            ? nextDueDays > 0
              ? daysFromNow(nextDueDays)
              : daysAgo(Math.abs(nextDueDays))
            : null,
        nextDueMileage: plan.intervalKm
          ? vehicle.currentMileage + randomBetween(-2000, 8000)
          : null,
        isActive: true,
      });
    }
  }

  const createdPlans = [];
  for (const plan of maintenancePlansData) {
    const created = await prisma.maintenancePlan.create({ data: plan });
    createdPlans.push(created);
    if (!plansPerVehicle[plan.vehicleId]) plansPerVehicle[plan.vehicleId] = [];
    plansPerVehicle[plan.vehicleId].push(created.id);
  }
  console.log(`   ✅ ${createdPlans.length} planos de manutenção`);

  // ─── Ordens de Serviço ────────────────────────────────────────────────────

  console.log('📋 Criando ordens de serviço...');

  const serviceOrderStatuses: ServiceOrderStatus[] = [
    'OPEN',
    'APPROVED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
  ];
  const soDescriptions = [
    'Troca de óleo e filtro',
    'Substituição de pastilhas de freio dianteiras',
    'Reparo no sistema elétrico — farol queimado',
    'Troca de correia dentada',
    'Revisão geral 50.000 km',
    'Troca de amortecedores traseiros',
    'Reparo no ar-condicionado',
    'Troca de bateria',
    'Alinhamento e balanceamento',
    'Substituição do radiador',
    'Troca de embreagem',
    'Revisão do sistema de injeção eletrônica',
  ];

  const serviceOrders = [];
  for (const vehicle of activeVehicles) {
    const numOrders = randomBetween(2, 6);
    for (let i = 0; i < numOrders; i++) {
      const status = randomItem(serviceOrderStatuses);
      const type = Math.random() > 0.6 ? MaintenanceType.CORRECTIVE : MaintenanceType.PREVENTIVE;
      const startDate = randomDate(120, 5);
      const endDate =
        status === 'COMPLETED'
          ? new Date(startDate.getTime() + randomBetween(1, 7) * 86400000)
          : null;
      const laborCost = randomFloat(150, 2000);
      const partsCost = randomFloat(50, 5000);
      const planIds = plansPerVehicle[vehicle.id] ?? [];
      const planId = type === 'PREVENTIVE' && planIds.length > 0 ? randomItem(planIds) : null;

      const so = await prisma.serviceOrder.create({
        data: {
          tenantId: tenant1.id,
          vehicleId: vehicle.id,
          driverId: randomItem(activeDrivers).id,
          planId,
          type,
          status,
          description: randomItem(soDescriptions),
          workshop: randomItem(OFICINAS),
          startDate,
          endDate,
          laborCost,
          partsCost,
          totalCost: parseFloat((laborCost + partsCost).toFixed(2)),
          notes: Math.random() > 0.5 ? 'Peças originais utilizadas' : null,
          approvedByUserId: status !== 'OPEN' ? t1Manager.id : null,
          createdByUserId: t1Admin.id,
        },
      });

      // Itens da OS
      const numItems = randomBetween(1, 4);
      for (let j = 0; j < numItems; j++) {
        const qty = randomBetween(1, 4);
        const unitCost = randomFloat(20, 800);
        await prisma.serviceOrderItem.create({
          data: {
            serviceOrderId: so.id,
            description: randomItem([
              'Filtro de óleo',
              'Óleo lubrificante 5W30 (litro)',
              'Pastilha de freio dianteira',
              'Correia do alternador',
              'Amortecedor traseiro',
              'Lâmpada farol H7',
              'Fluido de freio DOT4',
              'Junta do cabeçote',
              'Mão de obra mecânica',
              'Diagnóstico eletrônico',
            ]),
            quantity: qty,
            unitCost,
            totalCost: parseFloat((qty * unitCost).toFixed(2)),
            partNumber: Math.random() > 0.5 ? `PN-${randomBetween(10000, 99999)}` : null,
          },
        });
      }

      serviceOrders.push(so);
    }
  }
  console.log(`   ✅ ${serviceOrders.length} ordens de serviço`);

  // ─── Documentos ───────────────────────────────────────────────────────────

  console.log('📄 Criando documentos...');

  const documentsData = [];

  // Documentos de veículos
  for (const vehicle of vehicles) {
    const types = [
      DocumentType.IPVA,
      DocumentType.LICENSING,
      DocumentType.INSURANCE,
      DocumentType.INSPECTION,
    ];
    for (const type of types) {
      const daysUntilExpiry = randomBetween(-30, 365);
      const expDate =
        daysUntilExpiry > 0 ? daysFromNow(daysUntilExpiry) : daysAgo(Math.abs(daysUntilExpiry));
      const status =
        daysUntilExpiry < 0
          ? DocumentStatus.EXPIRED
          : daysUntilExpiry < 30
            ? DocumentStatus.EXPIRING
            : DocumentStatus.VALID;

      documentsData.push({
        tenantId: tenant1.id,
        vehicleId: vehicle.id,
        driverId: null,
        type,
        description: `${type} — ${vehicle.plate}`,
        expirationDate: expDate,
        alertDaysBefore: 30,
        cost:
          type === 'IPVA'
            ? randomFloat(1500, 8000)
            : type === 'INSURANCE'
              ? randomFloat(2000, 12000)
              : randomFloat(100, 500),
        fileUrl: `/uploads/documents/${vehicle.plate.toLowerCase()}-${type.toLowerCase()}.pdf`,
        status,
        notes: status === 'EXPIRED' ? 'ATENÇÃO: documento vencido!' : null,
      });
    }
  }

  // Documentos de motoristas (CNH, ASO)
  for (const driver of activeDrivers) {
    const cnhDays = randomBetween(-10, 300);
    const cnhExpDate = cnhDays > 0 ? daysFromNow(cnhDays) : daysAgo(Math.abs(cnhDays));

    documentsData.push({
      tenantId: tenant1.id,
      vehicleId: null,
      driverId: driver.id,
      type: DocumentType.CNH,
      description: `CNH — ${driver.name}`,
      expirationDate: cnhExpDate,
      alertDaysBefore: 30,
      cost: null,
      fileUrl: `/uploads/documents/cnh-${driver.cpf}.pdf`,
      status:
        cnhDays < 0
          ? DocumentStatus.EXPIRED
          : cnhDays < 30
            ? DocumentStatus.EXPIRING
            : DocumentStatus.VALID,
      notes: null,
    });
  }

  await prisma.document.createMany({ data: documentsData });
  console.log(`   ✅ ${documentsData.length} documentos`);

  // ─── Multas ───────────────────────────────────────────────────────────────

  console.log('🚨 Criando multas...');

  const finesDescriptions = [
    {
      desc: 'Excesso de velocidade — até 20% acima',
      severity: FineSeverity.MEDIUM,
      points: 4,
      amount: 130.16,
    },
    {
      desc: 'Excesso de velocidade — 20% a 50% acima',
      severity: FineSeverity.SERIOUS,
      points: 5,
      amount: 195.23,
    },
    {
      desc: 'Avançar sinal vermelho',
      severity: FineSeverity.VERY_SERIOUS,
      points: 7,
      amount: 293.47,
    },
    {
      desc: 'Estacionar em local proibido',
      severity: FineSeverity.LIGHT,
      points: 3,
      amount: 88.38,
    },
    {
      desc: 'Dirigir usando celular',
      severity: FineSeverity.VERY_SERIOUS,
      points: 7,
      amount: 293.47,
    },
    {
      desc: 'Não usar cinto de segurança',
      severity: FineSeverity.SERIOUS,
      points: 5,
      amount: 195.23,
    },
    {
      desc: 'Ultrapassagem proibida',
      severity: FineSeverity.VERY_SERIOUS,
      points: 7,
      amount: 293.47,
    },
    {
      desc: 'Parar sobre faixa de pedestres',
      severity: FineSeverity.MEDIUM,
      points: 4,
      amount: 130.16,
    },
    {
      desc: 'Trafegar com farol apagado',
      severity: FineSeverity.MEDIUM,
      points: 4,
      amount: 130.16,
    },
  ];

  const fineStatuses: FineStatus[] = [
    'PENDING',
    'DRIVER_IDENTIFIED',
    'APPEALED',
    'PAID',
    'PAYROLL_DEDUCTED',
  ];
  const finesData = [];

  for (let i = 0; i < 25; i++) {
    const fineInfo = randomItem(finesDescriptions);
    const fineDate = randomDate(180, 2);
    const dueDate = new Date(fineDate.getTime() + 30 * 86400000);

    finesData.push({
      tenantId: tenant1.id,
      vehicleId: randomItem(activeVehicles).id,
      driverId: Math.random() > 0.2 ? randomItem(activeDrivers).id : null,
      date: fineDate,
      autoNumber: `AI${randomBetween(100000, 999999)}`,
      location: randomItem(RUAS_CURITIBA),
      description: fineInfo.desc,
      severity: fineInfo.severity,
      points: fineInfo.points,
      amount: fineInfo.amount,
      discountAmount: Math.random() > 0.6 ? parseFloat((fineInfo.amount * 0.8).toFixed(2)) : null,
      dueDate,
      status: randomItem(fineStatuses),
      payrollDeduction: Math.random() > 0.7,
    });
  }

  await prisma.fine.createMany({ data: finesData });
  console.log(`   ✅ ${finesData.length} multas`);

  // ─── Sinistros ────────────────────────────────────────────────────────────

  console.log('💥 Criando sinistros...');

  const incidentTypes: IncidentType[] = ['COLLISION', 'THEFT', 'VANDALISM', 'NATURAL', 'OTHER'];
  const incidentStatuses: IncidentStatus[] = [
    'REGISTERED',
    'UNDER_ANALYSIS',
    'IN_REPAIR',
    'CONCLUDED',
  ];
  const incidentsData = [];

  for (let i = 0; i < 8; i++) {
    const iType = randomItem(incidentTypes);
    const iStatus = randomItem(incidentStatuses);
    const estimatedCost = randomFloat(500, 25000);

    incidentsData.push({
      tenantId: tenant1.id,
      vehicleId: randomItem(activeVehicles).id,
      driverId: Math.random() > 0.3 ? randomItem(activeDrivers).id : null,
      date: randomDate(180, 2),
      location: randomItem(RUAS_CURITIBA),
      type: iType,
      description:
        iType === 'COLLISION'
          ? 'Colisão traseira em semáforo'
          : iType === 'THEFT'
            ? 'Tentativa de furto no estacionamento'
            : iType === 'VANDALISM'
              ? 'Vidro lateral quebrado durante a noite'
              : iType === 'NATURAL'
                ? 'Granizo danificou capô e teto do veículo'
                : 'Dano ao veículo durante manobra no pátio',
      thirdPartyInvolved: iType === 'COLLISION',
      policeReport: iType === 'COLLISION' || iType === 'THEFT',
      insurerNotified: Math.random() > 0.3,
      insuranceClaimNumber: Math.random() > 0.5 ? `CLM${randomBetween(100000, 999999)}` : null,
      estimatedCost,
      actualCost:
        iStatus === 'CONCLUDED'
          ? parseFloat((estimatedCost * randomFloat(0.8, 1.3, 2)).toFixed(2))
          : null,
      status: iStatus,
      photos: [`/uploads/incidents/photo_${i}_1.jpg`, `/uploads/incidents/photo_${i}_2.jpg`],
      downtime: iStatus === 'CONCLUDED' ? randomBetween(1, 15) : null,
      notes: 'Registrado pelo gestor de frota',
    });
  }

  await prisma.incident.createMany({ data: incidentsData });
  console.log(`   ✅ ${incidentsData.length} sinistros`);

  // ─── Checklist Templates + Execuções ──────────────────────────────────────

  console.log('📋 Criando checklists...');

  const templateLight = await prisma.checklistTemplate.create({
    data: {
      tenantId: tenant1.id,
      name: 'Inspeção Diária — Veículo Leve',
      vehicleCategory: VehicleCategory.LIGHT,
    },
  });

  const templateHeavy = await prisma.checklistTemplate.create({
    data: {
      tenantId: tenant1.id,
      name: 'Inspeção Diária — Veículo Pesado',
      vehicleCategory: VehicleCategory.HEAVY,
    },
  });

  const lightItems = [
    'Nível do óleo do motor',
    'Nível do líquido de arrefecimento',
    'Estado dos pneus (visual)',
    'Faróis e lanternas funcionando',
    'Limpador de para-brisa',
    'Cinto de segurança',
    'Freio de mão',
    'Retrovisores íntegros',
    'Documentos no veículo (CRLV)',
    'Extintor de incêndio e triângulo',
  ];

  const heavyItems = [
    ...lightItems,
    'Sistema pneumático de freios',
    'Tacógrafo funcionando',
    'Lona de freio — desgaste visual',
    'Suspensão pneumática',
    'Engate e quinta roda',
    'Para-choques traseiro e faixas refletivas',
  ];

  const lightChecklistItems = await Promise.all(
    lightItems.map((label, i) =>
      prisma.checklistItem.create({
        data: {
          templateId: templateLight.id,
          label,
          required: true,
          photoRequired: i < 3,
          displayOrder: i,
        },
      }),
    ),
  );

  const heavyChecklistItems = await Promise.all(
    heavyItems.map((label, i) =>
      prisma.checklistItem.create({
        data: {
          templateId: templateHeavy.id,
          label,
          required: true,
          photoRequired: i < 5,
          displayOrder: i,
        },
      }),
    ),
  );

  // Execuções de checklist
  const executions = [];
  for (let i = 0; i < 30; i++) {
    const vehicle = randomItem(activeVehicles);
    const isHeavy = vehicle.category === 'HEAVY';
    const template = isHeavy ? templateHeavy : templateLight;
    const items = isHeavy ? heavyChecklistItems : lightChecklistItems;
    const driver = randomItem(activeDrivers);

    const overallStatus =
      Math.random() > 0.8
        ? ChecklistExecutionStatus.NON_COMPLIANT
        : Math.random() > 0.6
          ? ChecklistExecutionStatus.ATTENTION
          : ChecklistExecutionStatus.COMPLIANT;

    const execution = await prisma.checklistExecution.create({
      data: {
        tenantId: tenant1.id,
        templateId: template.id,
        vehicleId: vehicle.id,
        driverId: driver.id,
        executedAt: randomDate(60, 0),
        status: overallStatus,
        location: 'Pátio da empresa — Curitiba/PR',
        notes: overallStatus === 'NON_COMPLIANT' ? 'Itens críticos identificados' : null,
        createdByUserId: t1Drivers.length > 0 ? randomItem(t1Drivers).id : t1Admin.id,
      },
    });

    // Itens da execução
    for (const item of items) {
      const itemStatus =
        overallStatus === 'COMPLIANT'
          ? ChecklistItemStatus.OK
          : Math.random() > 0.7
            ? ChecklistItemStatus.NON_COMPLIANT
            : Math.random() > 0.5
              ? ChecklistItemStatus.ATTENTION
              : ChecklistItemStatus.OK;

      await prisma.checklistExecutionItem.create({
        data: {
          executionId: execution.id,
          checklistItemId: item.id,
          label: item.label,
          status: itemStatus,
          notes: itemStatus === 'NON_COMPLIANT' ? 'Necessita reparo imediato' : null,
        },
      });
    }

    executions.push(execution);
  }
  console.log(`   ✅ ${executions.length} execuções de checklist`);

  // ─── Pneus ────────────────────────────────────────────────────────────────

  console.log('🛞 Criando pneus e inspeções...');

  const tiresData = [];
  const tirePositions: Record<string, string[]> = {
    LIGHT: ['DE', 'DD', 'TE', 'TD'],
    HEAVY: ['DE', 'DD', 'TIE', 'TID', 'TEE', 'TED'],
    MOTORCYCLE: ['D', 'T'],
  };

  for (const vehicle of activeVehicles.slice(0, 8)) {
    const posKey =
      vehicle.category === 'MOTORCYCLE'
        ? 'MOTORCYCLE'
        : vehicle.category === 'HEAVY'
          ? 'HEAVY'
          : 'LIGHT';
    const positions = tirePositions[posKey];

    for (const pos of positions) {
      const originalGroove = randomFloat(8.0, 10.0);
      const currentGroove = randomFloat(2.5, originalGroove);
      const status = currentGroove < 3 ? TireStatus.IN_USE : TireStatus.IN_USE;

      tiresData.push({
        tenantId: tenant1.id,
        brand: randomItem(MARCAS_PNEU),
        model: randomItem(MODELOS_PNEU),
        size:
          vehicle.category === 'HEAVY'
            ? '295/80R22.5'
            : vehicle.category === 'MOTORCYCLE'
              ? '90/90-18'
              : '205/55R16',
        serialNumber: `SN${randomBetween(100000, 999999)}`,
        dot: `${randomBetween(1, 52)}${randomBetween(22, 26)}`,
        status,
        currentVehicleId: vehicle.id,
        position: pos,
        currentGrooveDepth: currentGroove,
        originalGrooveDepth: originalGroove,
        retreatCount: Math.random() > 0.7 ? 1 : 0,
        costNew: vehicle.category === 'HEAVY' ? randomFloat(800, 2000) : randomFloat(250, 600),
        costRetreat: Math.random() > 0.7 ? randomFloat(200, 500) : 0,
        totalKm: randomBetween(5000, 60000),
      });
    }
  }

  // Pneus em estoque (sem veículo)
  for (let i = 0; i < 6; i++) {
    const originalGroove = randomFloat(8.0, 10.0);
    tiresData.push({
      tenantId: tenant1.id,
      brand: randomItem(MARCAS_PNEU),
      model: randomItem(MODELOS_PNEU),
      size: i < 3 ? '295/80R22.5' : '205/55R16',
      serialNumber: `SN${randomBetween(900000, 999999)}`,
      dot: `${randomBetween(1, 52)}${randomBetween(24, 26)}`,
      status: i < 4 ? TireStatus.NEW : TireStatus.RETREADED,
      currentVehicleId: null,
      position: null,
      currentGrooveDepth: originalGroove,
      originalGrooveDepth: originalGroove,
      retreatCount: i >= 4 ? 1 : 0,
      costNew: i < 3 ? randomFloat(800, 2000) : randomFloat(250, 600),
      costRetreat: i >= 4 ? randomFloat(200, 500) : 0,
      totalKm: 0,
    });
  }

  const createdTires = [];
  for (const tire of tiresData) {
    const created = await prisma.tire.create({ data: tire });
    createdTires.push(created);
  }
  console.log(`   ✅ ${createdTires.length} pneus`);

  // Inspeções de pneus
  const installedTires = createdTires.filter(
    (tire) => tire.currentVehicleId !== null && tire.position !== null,
  );
  const tireInspections = [];
  for (const tire of installedTires) {
    if (tire.currentVehicleId === null || tire.position === null) {
      continue;
    }

    const numInspections = randomBetween(1, 4);
    for (let i = 0; i < numInspections; i++) {
      tireInspections.push({
        tenantId: tenant1.id,
        tireId: tire.id,
        vehicleId: tire.currentVehicleId,
        inspectedByUserId: t1Manager.id,
        date: randomDate(90, 1),
        grooveDepth: randomFloat(
          Math.max(tire.currentGrooveDepth - 1, 1.5),
          tire.originalGrooveDepth,
        ),
        position: tire.position,
        notes: Math.random() > 0.7 ? 'Desgaste irregular detectado' : null,
      });
    }
  }

  await prisma.tireInspection.createMany({ data: tireInspections });
  console.log(`   ✅ ${tireInspections.length} inspeções de pneus`);

  // ─── Notificações ─────────────────────────────────────────────────────────

  console.log('🔔 Criando notificações...');

  const notificationsData = [
    {
      type: NotificationType.CRITICAL,
      title: 'Manutenção vencida',
      message: 'A troca de óleo do veículo ABC-1A23 está vencida há 15 dias.',
      entityType: 'MaintenancePlan',
      entityId: createdPlans[0]?.id ?? 'unknown',
      userId: t1Admin.id,
    },
    {
      type: NotificationType.WARNING,
      title: 'Documento expirando',
      message: 'O IPVA do veículo DEF-2B34 vence em 10 dias.',
      entityType: 'Document',
      entityId: 'doc-placeholder',
      userId: t1Admin.id,
    },
    {
      type: NotificationType.WARNING,
      title: 'CNH expirando',
      message: 'A CNH do motorista Pedro Santos vence em 45 dias.',
      entityType: 'Driver',
      entityId: drivers[1]?.id ?? 'unknown',
      userId: t1Admin.id,
    },
    {
      type: NotificationType.CRITICAL,
      title: 'CNH vencida',
      message: 'A CNH do motorista Lucas Ferreira está vencida!',
      entityType: 'Driver',
      entityId: drivers[3]?.id ?? 'unknown',
      userId: t1Admin.id,
    },
    {
      type: NotificationType.INFO,
      title: 'Multa registrada',
      message: 'Nova multa registrada para o veículo GHI-3C45 — Excesso de velocidade.',
      entityType: 'Fine',
      entityId: 'fine-placeholder',
      userId: t1Admin.id,
    },
    {
      type: NotificationType.WARNING,
      title: 'Anomalia de consumo',
      message:
        'O veículo STU-7G89 registrou consumo 45% abaixo da média. Possível problema mecânico ou desvio.',
      entityType: 'FuelRecord',
      entityId: 'fuel-placeholder',
      userId: t1Admin.id,
    },
    {
      type: NotificationType.CRITICAL,
      title: 'Pneu no limite',
      message:
        'O pneu SN na posição DE do veículo ABC-1A23 está com sulco abaixo de 3mm. Troca recomendada.',
      entityType: 'Tire',
      entityId: createdTires[0]?.id ?? 'unknown',
      userId: t1Admin.id,
    },
    {
      type: NotificationType.INFO,
      title: 'OS concluída',
      message: 'A Ordem de Serviço #OS-001 do veículo MNO-5E67 foi concluída com sucesso.',
      entityType: 'ServiceOrder',
      entityId: serviceOrders[0]?.id ?? 'unknown',
      userId: t1Manager.id,
    },
    {
      type: NotificationType.WARNING,
      title: 'Checklist não conforme',
      message:
        'O checklist do veículo VWX-8H90 executado hoje registrou itens não conformes. Verificar.',
      entityType: 'ChecklistExecution',
      entityId: executions[0]?.id ?? 'unknown',
      userId: t1Manager.id,
    },
    {
      type: NotificationType.INFO,
      title: 'Novo sinistro registrado',
      message: 'Um novo sinistro foi registrado para o veículo DEF-2B34 — colisão traseira.',
      entityType: 'Incident',
      entityId: 'inc-placeholder',
      userId: t1Admin.id,
    },
  ];

  // Mais notificações para simular volume
  for (const u of [t1Admin, t1Manager]) {
    for (let i = 0; i < 5; i++) {
      notificationsData.push({
        type: randomItem([NotificationType.INFO, NotificationType.WARNING]),
        title: 'Lembrete de revisão',
        message: `Verifique a manutenção pendente do veículo ${randomItem(activeVehicles).plate}.`,
        entityType: 'MaintenancePlan',
        entityId: randomItem(createdPlans).id,
        userId: u.id,
      });
    }
  }

  await prisma.notification.createMany({
    data: notificationsData.map((n, i) => ({
      tenantId: tenant1.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      entityType: n.entityType,
      entityId: n.entityId,
      isRead: i < 5 ? false : Math.random() > 0.4,
      readAt: i >= 5 && Math.random() > 0.4 ? daysAgo(randomBetween(0, 10)) : null,
    })),
  });
  console.log(`   ✅ ${notificationsData.length} notificações`);

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  console.log('📝 Criando audit logs...');

  const auditActions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT'];
  const auditEntities = [
    'Vehicle',
    'Driver',
    'FuelRecord',
    'ServiceOrder',
    'Fine',
    'Document',
    'Tire',
    'Incident',
  ];
  const auditLogs = [];

  for (let i = 0; i < 50; i++) {
    auditLogs.push({
      tenantId: tenant1.id,
      userId: randomItem([t1Admin.id, t1Manager.id]),
      action: randomItem(auditActions),
      entity: randomItem(auditEntities),
      entityId: randomItem(vehicles).id,
      changes: { source: 'seed-dev' },
      ipAddress: '192.168.1.' + randomBetween(2, 254),
      userAgent: 'Mozilla/5.0 (seed)',
    });
  }

  await prisma.auditLog.createMany({ data: auditLogs });
  console.log(`   ✅ ${auditLogs.length} audit logs`);

  // ─── Tenant 2: dados mínimos para teste multi-tenant ──────────────────────

  console.log('🏢 Criando dados do segundo tenant (mínimo)...');

  const t2Users = users.filter((u) => u.tenantId === tenant2.id);
  const t2Owner = ensureDefined(
    t2Users.find((u) => u.role === 'OWNER'),
    'Usuário OWNER do segundo tenant não encontrado.',
  );
  const t2Driver = ensureDefined(
    t2Users.find((u) => u.role === 'DRIVER'),
    'Usuário DRIVER do segundo tenant não encontrado.',
  );

  const t2DriverProfile = await prisma.driver.create({
    data: {
      tenantId: tenant2.id,
      name: 'Thiago Motorista',
      cpf: '77777777777',
      phone: '(41) 98888-2222',
      cnhNumber: 'CNH99001',
      cnhCategory: 'B',
      cnhExpiration: daysFromNow(200),
      isActive: true,
      hireDate: daysAgo(300),
      score: 90,
      userId: t2Driver.id,
    },
  });

  const t2Vehicles = await Promise.all([
    prisma.vehicle.create({
      data: {
        tenantId: tenant2.id,
        plate: 'LOG-1A00',
        brand: 'Fiat',
        model: 'Ducato Cargo',
        year: 2023,
        yearModel: 2024,
        fuelType: FuelType.DIESEL,
        category: VehicleCategory.HEAVY,
        status: VehicleStatus.ACTIVE,
        currentMileage: 25000,
        expectedConsumption: 8.0,
        acquisitionValue: 150000,
        color: 'Branco',
      },
    }),
    prisma.vehicle.create({
      data: {
        tenantId: tenant2.id,
        plate: 'LOG-2B00',
        brand: 'Volkswagen',
        model: 'Gol',
        year: 2022,
        yearModel: 2023,
        fuelType: FuelType.GASOLINE,
        category: VehicleCategory.LIGHT,
        status: VehicleStatus.ACTIVE,
        currentMileage: 40000,
        expectedConsumption: 12.0,
        acquisitionValue: 60000,
        color: 'Prata',
      },
    }),
  ]);

  // Poucos registros de combustível para tenant 2
  for (const v of t2Vehicles) {
    for (let i = 0; i < 3; i++) {
      const liters = randomFloat(25, 50);
      const pricePerLiter = randomFloat(5.5, 6.8);
      await prisma.fuelRecord.create({
        data: {
          tenantId: tenant2.id,
          vehicleId: v.id,
          driverId: t2DriverProfile.id,
          date: randomDate(60, 1),
          mileage: v.currentMileage - randomBetween(500, 2000) + i * randomBetween(300, 700),
          liters,
          pricePerLiter,
          totalCost: parseFloat((liters * pricePerLiter).toFixed(2)),
          fuelType: v.fuelType,
          fullTank: true,
          gasStation: randomItem(POSTOS),
          kmPerLiter: randomFloat(6, 12),
          createdByUserId: t2Owner.id,
        },
      });
    }
  }

  console.log('   ✅ Dados do tenant 2 criados');

  // ─── Resumo ───────────────────────────────────────────────────────────────

  console.log('\n✅ Seed de desenvolvimento concluído com sucesso!\n');
  console.log('📊 Resumo:');
  console.log(`   • 2 tenants (Professional + Essential/Trial)`);
  console.log(`   • ${users.length} usuários (senha: 123456)`);
  console.log(`   • ${drivers.length + 1} motoristas`);
  console.log(`   • ${vehicles.length + t2Vehicles.length} veículos`);
  console.log(`   • ${fuelRecords.length + 6} registros de combustível`);
  console.log(`   • ${createdPlans.length} planos de manutenção`);
  console.log(`   • ${serviceOrders.length} ordens de serviço`);
  console.log(`   • ${documentsData.length} documentos`);
  console.log(`   • ${finesData.length} multas`);
  console.log(`   • ${incidentsData.length} sinistros`);
  console.log(`   • ${executions.length} execuções de checklist`);
  console.log(`   • ${createdTires.length} pneus`);
  console.log(`   • ${tireInspections.length} inspeções de pneus`);
  console.log(`   • ${notificationsData.length} notificações`);
  console.log(`   • ${auditLogs.length} audit logs`);
  console.log('\n🔑 Credenciais de acesso:');
  console.log('   Tenant 1 (Professional): admin@demo.com / 123456');
  console.log('   Tenant 2 (Essential):    admin@lograpida.com / 123456');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    await prisma.$disconnect();
    process.exit(1);
  });
