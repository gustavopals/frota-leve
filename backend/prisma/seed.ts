import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Criar tenant de exemplo
  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Empresa Demo',
      document: '12.345.678/0001-90',
      isActive: true,
    },
  });

  console.log('✅ Tenant criado:', tenant.name);

  // Criar usuário admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Admin Demo',
      email: 'admin@demo.com',
      passwordHash: hashedPassword,
      role: 'ADMIN_EMPRESA',
      isActive: true,
    },
  });

  console.log('✅ Usuário admin criado:', adminUser.email);

  // Criar usuário motorista
  const driverUser = await prisma.user.upsert({
    where: { email: 'motorista@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Motorista Demo',
      email: 'motorista@demo.com',
      passwordHash: await bcrypt.hash('motorista123', 10),
      role: 'MOTORISTA',
      isActive: true,
    },
  });

  console.log('✅ Usuário motorista criado:', driverUser.email);

  // Criar veículos de exemplo
  const vehicle1 = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      name: 'Hilux Prata 2020',
      plate: 'ABC-1234',
      renavam: '12345678901',
      type: 'pickup',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2020,
      currentOdometer: 45000,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Veículo criado:', vehicle1.name);

  const vehicle2 = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      name: 'Sprinter Branca 2019',
      plate: 'XYZ-9876',
      type: 'van',
      brand: 'Mercedes-Benz',
      model: 'Sprinter',
      year: 2019,
      currentOdometer: 78000,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Veículo criado:', vehicle2.name);

  // Criar plano de manutenção
  const maintenancePlan = await prisma.maintenancePlan.create({
    data: {
      tenantId: tenant.id,
      name: 'Troca de Óleo',
      description: 'Troca de óleo do motor',
      intervalKm: 10000,
      intervalDays: 180,
      vehicleType: 'pickup',
      isActive: true,
    },
  });

  console.log('✅ Plano de manutenção criado:', maintenancePlan.name);

  // Criar template de checklist
  const checklistTemplate = await prisma.checklistTemplate.create({
    data: {
      tenantId: tenant.id,
      name: 'Checklist Diário Padrão',
      vehicleType: null,
      isActive: true,
      items: {
        create: [
          {
            label: 'Nível de óleo',
            type: 'BOOLEAN',
            sortOrder: 1,
          },
          {
            label: 'Pressão dos pneus',
            type: 'SELECT',
            config: { options: ['OK', 'Atenção', 'Crítico'] },
            sortOrder: 2,
          },
          {
            label: 'Funcionamento das luzes',
            type: 'BOOLEAN',
            sortOrder: 3,
          },
          {
            label: 'Freios',
            type: 'BOOLEAN',
            sortOrder: 4,
          },
          {
            label: 'Observações',
            type: 'TEXT',
            sortOrder: 5,
          },
        ],
      },
    },
  });

  console.log('✅ Template de checklist criado:', checklistTemplate.name);

  // Criar configurações do tenant
  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      preferences: {
        locale: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        distanceUnit: 'km',
        alertDaysBeforeDue: 15,
        notificationChannels: {
          maintenance: ['email'],
          documents: ['email'],
        },
      },
    },
  });

  console.log('✅ Configurações do tenant criadas');

  // Criar lembretes de exemplo
  await prisma.reminder.create({
    data: {
      tenantId: tenant.id,
      vehicleId: vehicle1.id,
      type: 'IPVA',
      title: 'Vencimento IPVA 2025',
      dueDate: new Date('2025-03-31'),
      status: 'PENDING',
    },
  });

  await prisma.reminder.create({
    data: {
      tenantId: tenant.id,
      vehicleId: vehicle1.id,
      type: 'MAINTENANCE',
      title: 'Revisão 50.000 km',
      dueOdometer: 50000,
      status: 'PENDING',
    },
  });

  console.log('✅ Lembretes criados');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📝 Credenciais de acesso:');
  console.log('   Admin: admin@demo.com / admin123');
  console.log('   Motorista: motorista@demo.com / motorista123');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
