import { PrismaClient, PlanType, TenantStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertUser(params: {
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  passwordHash: string;
}) {
  const { email, name, role, tenantId, passwordHash } = params;

  return prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email,
      },
    },
    update: {
      name,
      role,
      passwordHash,
      isActive: true,
    },
    create: {
      tenantId,
      email,
      name,
      role,
      passwordHash,
      isActive: true,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);

  const tenant = await prisma.tenant.upsert({
    where: {
      cnpj: '12345678000199',
    },
    update: {
      name: 'Transportadora Demo Ltda',
      tradeName: 'Transportadora Demo',
      email: 'contato@demo.com',
      phone: '(41) 99999-0000',
      plan: PlanType.PROFESSIONAL,
      status: TenantStatus.TRIAL,
      trialEndsAt: new Date('2026-12-31T23:59:59.000Z'),
      address: {
        street: 'Rua das Frotas',
        number: '123',
        neighborhood: 'Centro',
        city: 'Curitiba',
        state: 'PR',
        zipCode: '80000-000',
      },
      settings: {
        locale: 'pt-BR',
        timezone: 'America/Sao_Paulo',
      },
    },
    create: {
      name: 'Transportadora Demo Ltda',
      tradeName: 'Transportadora Demo',
      cnpj: '12345678000199',
      email: 'contato@demo.com',
      phone: '(41) 99999-0000',
      plan: PlanType.PROFESSIONAL,
      status: TenantStatus.TRIAL,
      trialEndsAt: new Date('2026-12-31T23:59:59.000Z'),
      address: {
        street: 'Rua das Frotas',
        number: '123',
        neighborhood: 'Centro',
        city: 'Curitiba',
        state: 'PR',
        zipCode: '80000-000',
      },
      settings: {
        locale: 'pt-BR',
        timezone: 'America/Sao_Paulo',
      },
    },
  });

  await Promise.all([
    upsertUser({
      tenantId: tenant.id,
      email: 'admin@demo.com',
      name: 'Administrador Demo',
      role: UserRole.OWNER,
      passwordHash,
    }),
    upsertUser({
      tenantId: tenant.id,
      email: 'gestor@demo.com',
      name: 'Gestor Demo',
      role: UserRole.MANAGER,
      passwordHash,
    }),
    upsertUser({
      tenantId: tenant.id,
      email: 'motorista@demo.com',
      name: 'Motorista Demo',
      role: UserRole.DRIVER,
      passwordHash,
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      action: 'SEED',
      entity: 'Tenant',
      entityId: tenant.id,
      changes: {
        source: 'packages/database/prisma/seed.ts',
        users: ['admin@demo.com', 'gestor@demo.com', 'motorista@demo.com'],
      },
    },
  });
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
