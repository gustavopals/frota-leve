import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PlanType, TenantStatus, UserRole } from '@frota-leve/database';
import { createApp } from '../../app';
import { authCache } from './auth.cache';

type MockTransactionClient = {
  tenant: {
    create: jest.Mock;
  };
  user: {
    create: jest.Mock;
    update: jest.Mock;
  };
  passwordResetToken: {
    create: jest.Mock;
    updateMany: jest.Mock;
  };
};

type MockPrisma = {
  tenant: {
    findUnique: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  passwordResetToken: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

jest.mock('../../config/database', () => {
  const transactionClientMock: MockTransactionClient = {
    tenant: {
      create: jest.fn(),
    },
    user: {
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prisma: MockPrisma & {
    __transactionClientMock: MockTransactionClient;
  } = {
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    __transactionClientMock: transactionClientMock,
  };

  return {
    prisma,
  };
});

const databaseMock = jest.requireMock('../../config/database') as {
  prisma: MockPrisma & {
    __transactionClientMock: MockTransactionClient;
  };
};

const prismaMock = databaseMock.prisma;
const transactionClientMock = databaseMock.prisma.__transactionClientMock;

type MockTenant = {
  id: string;
  name: string;
  plan: PlanType;
  status: TenantStatus;
  trialEndsAt: Date | null;
  email: string;
  cnpj: string;
};

type MockUserWithTenant = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenant: MockTenant;
};

function createTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: 'tenant-auth-1',
    name: 'Empresa Auth',
    plan: PlanType.PROFESSIONAL,
    status: TenantStatus.TRIAL,
    trialEndsAt: new Date('2026-04-21T00:00:00.000Z'),
    email: 'owner@empresa.com',
    cnpj: '12345678000195',
    ...overrides,
  };
}

function createUserWithTenant(
  tenant: MockTenant,
  passwordHash: string,
  overrides: Partial<MockUserWithTenant> = {},
): MockUserWithTenant {
  return {
    id: 'user-auth-1',
    tenantId: tenant.id,
    name: 'Owner Auth',
    email: 'owner@empresa.com',
    passwordHash,
    role: UserRole.OWNER,
    isActive: true,
    lastLoginAt: null,
    avatarUrl: null,
    createdAt: new Date('2026-04-07T10:00:00.000Z'),
    updatedAt: new Date('2026-04-07T10:00:00.000Z'),
    tenant,
    ...overrides,
  };
}

function createAccessToken(user: MockUserWithTenant): string {
  return jwt.sign(
    {
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      type: 'access',
    },
    process.env['JWT_SECRET'] as string,
    {
      subject: user.id,
      expiresIn: '15m',
      jwtid: randomUUID(),
    },
  );
}

function createRefreshToken(user: MockUserWithTenant): string {
  return jwt.sign(
    {
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      type: 'refresh',
    },
    process.env['JWT_REFRESH_SECRET'] as string,
    {
      subject: user.id,
      expiresIn: '7d',
      jwtid: randomUUID(),
    },
  );
}

describe('Auth endpoints', () => {
  let app: ReturnType<typeof createApp>;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Senha1234', 12);
  });

  beforeEach(() => {
    app = createApp();
    authCache.clear();
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transactionClientMock) => Promise<unknown>) =>
        callback(transactionClientMock),
    );
  });

  it('POST /api/v1/auth/register deve registrar tenant e owner com sucesso', async () => {
    const tenant = createTenant();
    const createdUser = createUserWithTenant(tenant, passwordHash, {
      email: 'owner@empresa.com',
      name: 'Novo Owner',
    });

    prismaMock.tenant.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    transactionClientMock.tenant.create.mockResolvedValue(tenant);
    transactionClientMock.user.create.mockResolvedValue(createdUser);

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Novo Owner',
      email: 'Owner@Empresa.com',
      password: 'Senha1234',
      companyName: 'Empresa Auth',
      cnpj: '12.345.678/0001-95',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: {
        id: createdUser.id,
        tenantId: tenant.id,
        name: 'Novo Owner',
        email: 'owner@empresa.com',
        role: UserRole.OWNER,
        isActive: true,
        lastLoginAt: null,
        avatarUrl: null,
        createdAt: createdUser.createdAt.toISOString(),
        updatedAt: createdUser.updatedAt.toISOString(),
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: PlanType.PROFESSIONAL,
        status: TenantStatus.TRIAL,
        trialEndsAt: tenant.trialEndsAt?.toISOString(),
      },
    });
  });

  it('POST /api/v1/auth/register deve falhar com CNPJ duplicado', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(createTenant());

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Novo Owner',
      email: 'owner@empresa.com',
      password: 'Senha1234',
      companyName: 'Empresa Auth',
      cnpj: '12.345.678/0001-95',
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'CNPJ já cadastrado',
      },
    });
  });

  it('POST /api/v1/auth/register deve falhar com e-mail duplicado', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue({ id: 'existing-user' });

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Novo Owner',
      email: 'owner@empresa.com',
      password: 'Senha1234',
      companyName: 'Empresa Auth',
      cnpj: '12.345.678/0001-95',
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'E-mail já cadastrado',
      },
    });
  });

  it('POST /api/v1/auth/register deve falhar com CNPJ inválido', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Novo Owner',
      email: 'owner@empresa.com',
      password: 'Senha1234',
      companyName: 'Empresa Auth',
      cnpj: '11.111.111/1111-11',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('POST /api/v1/auth/login deve autenticar usuário ativo', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash);
    const updatedUser = createUserWithTenant(tenant, passwordHash, {
      lastLoginAt: new Date('2026-04-07T11:00:00.000Z'),
    });

    prismaMock.user.findFirst.mockResolvedValue(user);
    prismaMock.user.update.mockResolvedValue(updatedUser);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'owner@empresa.com',
      password: 'Senha1234',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: {
        id: updatedUser.id,
        tenantId: updatedUser.tenantId,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: true,
        lastLoginAt: updatedUser.lastLoginAt?.toISOString(),
        avatarUrl: null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt?.toISOString(),
      },
    });
  });

  it('POST /api/v1/auth/login deve falhar com senha errada', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash);

    prismaMock.user.findFirst.mockResolvedValue(user);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'owner@empresa.com',
      password: 'SenhaErrada123',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'E-mail ou senha inválidos',
      },
    });
  });

  it('POST /api/v1/auth/login deve falhar com usuário inativo', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash, {
      isActive: false,
    });

    prismaMock.user.findFirst.mockResolvedValue(user);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'owner@empresa.com',
      password: 'Senha1234',
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Usuário inativo',
      },
    });
  });

  it('POST /api/v1/auth/refresh deve rotacionar refresh token válido', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash);
    const refreshToken = createRefreshToken(user);

    prismaMock.user.findUnique.mockResolvedValue(user);

    const response = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: {
        id: user.id,
        email: user.email,
      },
      tenant: {
        id: tenant.id,
        plan: tenant.plan,
      },
    });
    expect(response.body.refreshToken).not.toBe(refreshToken);
  });

  it('POST /api/v1/auth/forgot-password deve retornar mensagem genérica quando e-mail existe', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash);

    prismaMock.user.findFirst.mockResolvedValue(user);
    transactionClientMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    transactionClientMock.passwordResetToken.create.mockResolvedValue({
      id: randomUUID(),
      userId: user.id,
      tokenHash: 'any-hash',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    });

    const response = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'owner@empresa.com',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Se o e-mail existir, enviaremos as instruções de recuperação.',
    });
  });

  it('POST /api/v1/auth/forgot-password deve retornar a mesma mensagem quando e-mail não existe', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const response = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'naoexiste@empresa.com',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Se o e-mail existir, enviaremos as instruções de recuperação.',
    });
    // Não deve chamar $transaction quando o e-mail não existe
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('POST /api/v1/auth/reset-password deve redefinir senha com token válido', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash);
    const resetToken = randomUUID();
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');

    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
      user: { id: user.id, passwordHash },
    });
    transactionClientMock.user.update.mockResolvedValue(user);
    transactionClientMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: resetToken,
      newPassword: 'NovaSenha123',
      confirmPassword: 'NovaSenha123',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Senha redefinida com sucesso',
    });
  });

  it('POST /api/v1/auth/reset-password deve falhar com token expirado', async () => {
    const resetToken = randomUUID();
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');

    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: randomUUID(),
      userId: 'user-id',
      tokenHash,
      expiresAt: new Date(Date.now() - 1000), // expirado
      usedAt: null,
      user: { id: 'user-id', passwordHash },
    });

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: resetToken,
      newPassword: 'NovaSenha123',
      confirmPassword: 'NovaSenha123',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Token de redefinição inválido ou expirado' },
    });
  });

  it('POST /api/v1/auth/reset-password deve falhar com token já utilizado', async () => {
    const resetToken = randomUUID();
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');

    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: randomUUID(),
      userId: 'user-id',
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(), // já utilizado
      user: { id: 'user-id', passwordHash },
    });

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: resetToken,
      newPassword: 'NovaSenha123',
      confirmPassword: 'NovaSenha123',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Token de redefinição inválido ou expirado' },
    });
  });

  it('POST /api/v1/auth/reset-password deve falhar com token inexistente', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: randomUUID(),
      newPassword: 'NovaSenha123',
      confirmPassword: 'NovaSenha123',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Token de redefinição inválido ou expirado' },
    });
  });

  it('POST /api/v1/auth/change-password deve alterar senha com autenticação', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash);
    const accessToken = createAccessToken(user);

    prismaMock.user.findUnique
      // 1ª chamada: middleware authenticate (select)
      .mockResolvedValueOnce({
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        isActive: true,
      })
      // 2ª chamada: changePassword service (findUnique para validar senha atual)
      .mockResolvedValueOnce({ id: user.id, passwordHash });
    prismaMock.user.update.mockResolvedValue(user);

    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Senha1234', newPassword: 'NovaSenha123' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Senha alterada com sucesso',
    });
  });

  it('POST /api/v1/auth/change-password deve falhar com senha atual inválida', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash);
    const accessToken = createAccessToken(user);

    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        isActive: true,
      })
      .mockResolvedValueOnce({ id: user.id, passwordHash }); // passwordHash de 'Senha1234'

    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'SenhaErrada123', newPassword: 'NovaSenha123' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Senha atual inválida' },
    });
  });

  it('GET /api/v1/auth/me deve retornar usuário autenticado e tenant', async () => {
    const tenant = createTenant();
    const user = createUserWithTenant(tenant, passwordHash);
    const accessToken = createAccessToken(user);

    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        isActive: true,
      })
      .mockResolvedValueOnce(user);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
    });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: true,
        lastLoginAt: null,
        avatarUrl: null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt?.toISOString(),
      },
    });
  });
});
