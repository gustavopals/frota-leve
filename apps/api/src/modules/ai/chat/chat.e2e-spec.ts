import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AIChatMessageRole, PlanType, TenantStatus, UserRole } from '@frota-leve/database';
import { createApp } from '../../../app';
import { authCache } from '../../auth/auth.cache';

type MockTenant = {
  id: string;
  name: string;
  plan: PlanType;
  status: TenantStatus;
  trialEndsAt: Date | null;
};

type MockAuthenticatedUser = {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
  isActive: boolean;
};

type MockChatSession = {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

type MockChatMessage = {
  id: string;
  sessionId: string;
  role: AIChatMessageRole;
  content: { text: string };
  tokensIn: number | null;
  tokensOut: number | null;
  model: string | null;
  createdAt: Date;
};

type MockPrisma = {
  tenant: {
    findUnique: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
  aIChatSession: {
    create: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  aIChatMessage: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
};

type MockStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; ok: boolean }
  | {
      type: 'done';
      finalText: string;
      usage: { inputTokens: number; outputTokens: number };
      iterations: number;
    }
  | { type: 'error'; message: string; code?: string };

type ParsedSseEvent = {
  event: string;
  data: MockStreamEvent & { messageId?: string };
};

jest.mock('../../../middlewares/ai-feature-flag', () => ({
  aiFeatureFlag: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../../config/database', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    aIChatSession: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    aIChatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@frota-leve/ai', () => ({
  AI_MODEL_SONNET: 'claude-sonnet-4-6',
  assistantService: {
    streamTurn: jest.fn(),
  },
  buildAssistantSystemPrompt: jest.fn(() => 'system prompt mockado'),
  buildFleetCatalogContext: jest.fn(async () => '{"contextKind":"fleetCatalog"}'),
}));

const databaseMock = jest.requireMock('../../../config/database') as { prisma: MockPrisma };
const aiMock = jest.requireMock('@frota-leve/ai') as {
  assistantService: { streamTurn: jest.Mock };
  buildFleetCatalogContext: jest.Mock;
};

const prismaMock = databaseMock.prisma;

function createTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Empresa IA',
    plan: PlanType.PROFESSIONAL,
    status: TenantStatus.ACTIVE,
    trialEndsAt: null,
    ...overrides,
  };
}

function createAuthenticatedUser(
  tenant: MockTenant,
  overrides: Partial<MockAuthenticatedUser> = {},
): MockAuthenticatedUser {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    tenantId: tenant.id,
    role: UserRole.MANAGER,
    email: 'gestor@empresa.com',
    isActive: true,
    ...overrides,
  };
}

function createSession(
  tenant: MockTenant,
  user: MockAuthenticatedUser,
  overrides: Partial<MockChatSession> = {},
): MockChatSession {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tenantId: tenant.id,
    userId: user.id,
    title: 'Nova conversa',
    createdAt: new Date('2026-04-18T10:00:00.000Z'),
    updatedAt: new Date('2026-04-18T10:00:00.000Z'),
    archivedAt: null,
    ...overrides,
  };
}

function createMessage(
  session: MockChatSession,
  role: AIChatMessageRole,
  text: string,
  overrides: Partial<MockChatMessage> = {},
): MockChatMessage {
  return {
    id:
      role === AIChatMessageRole.USER
        ? '44444444-4444-4444-8444-444444444444'
        : '55555555-5555-4555-8555-555555555555',
    sessionId: session.id,
    role,
    content: { text },
    tokensIn: null,
    tokensOut: null,
    model: null,
    createdAt: new Date('2026-04-18T10:01:00.000Z'),
    ...overrides,
  };
}

function createAccessToken(user: MockAuthenticatedUser): string {
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
      jwtid: '66666666-6666-4666-8666-666666666666',
    },
  );
}

async function* streamEvents(events: MockStreamEvent[]): AsyncGenerator<MockStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

function parseSseEvents(text: string): ParsedSseEvent[] {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const eventLine = block.split('\n').find((line) => line.startsWith('event: '));
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));

      return {
        event: eventLine?.slice('event: '.length) ?? '',
        data: JSON.parse(dataLine?.slice('data: '.length) ?? '{}') as ParsedSseEvent['data'],
      };
    });
}

describe('AI chat endpoints', () => {
  let app: ReturnType<typeof createApp>;
  let tenant: MockTenant;
  let user: MockAuthenticatedUser;
  let token: string;

  beforeEach(() => {
    app = createApp();
    authCache.clear();
    jest.clearAllMocks();

    tenant = createTenant();
    user = createAuthenticatedUser(tenant);
    token = createAccessToken(user);

    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.tenant.findUnique.mockResolvedValue(tenant);
    aiMock.assistantService.streamTurn.mockImplementation(() =>
      streamEvents([
        { type: 'tool_use', name: 'getTopCostVehicles', input: { limit: 5 } },
        { type: 'tool_result', name: 'getTopCostVehicles', ok: true },
        { type: 'delta', text: 'Resposta ' },
        { type: 'delta', text: 'mockada.' },
        {
          type: 'done',
          finalText: 'Resposta mockada.',
          usage: { inputTokens: 120, outputTokens: 30 },
          iterations: 1,
        },
      ]),
    );
  });

  it('POST /api/v1/ai/chat/sessions cria sessão para o usuário autenticado', async () => {
    const session = createSession(tenant, user, { title: 'Resumo abril' });
    prismaMock.aIChatSession.create.mockResolvedValue(session);

    const response = await request(app)
      .post('/api/v1/ai/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Resumo abril' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: session.id,
        tenantId: tenant.id,
        userId: user.id,
        title: 'Resumo abril',
      },
    });
    expect(prismaMock.aIChatSession.create).toHaveBeenCalledWith({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        title: 'Resumo abril',
      },
    });
  });

  it('lista e arquiva sessões sem cruzar tenants', async () => {
    const session = createSession(tenant, user);
    prismaMock.aIChatSession.count.mockResolvedValue(1);
    prismaMock.aIChatSession.findMany.mockResolvedValue([session]);
    prismaMock.aIChatSession.findFirst.mockResolvedValue(session);
    prismaMock.aIChatSession.update.mockResolvedValue({
      ...session,
      archivedAt: new Date('2026-04-18T11:00:00.000Z'),
    });

    const listResponse = await request(app)
      .get('/api/v1/ai/chat/sessions')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toMatchObject({
      success: true,
      data: [{ id: session.id, tenantId: tenant.id, userId: user.id }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(prismaMock.aIChatSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenant.id, userId: user.id, archivedAt: null },
      }),
    );

    const archiveResponse = await request(app)
      .delete(`/api/v1/ai/chat/sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(archiveResponse.status).toBe(204);
    expect(prismaMock.aIChatSession.findFirst).toHaveBeenCalledWith({
      where: { id: session.id, tenantId: tenant.id, userId: user.id },
    });
    expect(prismaMock.aIChatSession.update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it('envia mensagem via SSE, persiste user/assistant e inclui tool loop', async () => {
    const session = createSession(tenant, user);
    const userMessage = createMessage(session, AIChatMessageRole.USER, 'Top custos?');
    const assistantMessage = createMessage(
      session,
      AIChatMessageRole.ASSISTANT,
      'Resposta mockada.',
      {
        tokensIn: 120,
        tokensOut: 30,
        model: 'claude-sonnet-4-6',
      },
    );

    prismaMock.aIChatSession.findFirst.mockResolvedValue(session);
    prismaMock.aIChatMessage.create
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantMessage);
    prismaMock.aIChatMessage.findMany.mockResolvedValue([userMessage]);
    prismaMock.aIChatSession.update.mockResolvedValue(session);

    const response = await request(app)
      .post(`/api/v1/ai/chat/sessions/${session.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Quais veículos tiveram maior custo no mês?' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    const events = parseSseEvents(response.text);
    expect(events.map((event) => event.event)).toEqual([
      'tool_use',
      'tool_result',
      'delta',
      'delta',
      'done',
    ]);
    expect(events.at(-1)?.data).toMatchObject({
      type: 'done',
      finalText: 'Resposta mockada.',
      messageId: assistantMessage.id,
    });

    expect(aiMock.buildFleetCatalogContext).toHaveBeenCalledWith(tenant.id);
    expect(prismaMock.aIChatMessage.create).toHaveBeenNthCalledWith(1, {
      data: {
        sessionId: session.id,
        role: AIChatMessageRole.USER,
        content: { text: 'Quais veículos tiveram maior custo no mês?' },
      },
    });
    expect(prismaMock.aIChatMessage.create).toHaveBeenNthCalledWith(2, {
      data: {
        sessionId: session.id,
        role: AIChatMessageRole.ASSISTANT,
        content: { text: 'Resposta mockada.' },
        tokensIn: 120,
        tokensOut: 30,
        model: 'claude-sonnet-4-6',
      },
    });
  });

  it('bloqueia tenants ESSENTIAL antes de criar sessões', async () => {
    const blockedTenant = createTenant({ plan: PlanType.ESSENTIAL });
    const blockedUser = createAuthenticatedUser(blockedTenant);
    const blockedToken = createAccessToken(blockedUser);

    prismaMock.user.findUnique.mockResolvedValue(blockedUser);
    prismaMock.tenant.findUnique.mockResolvedValue(blockedTenant);

    const response = await request(app)
      .post('/api/v1/ai/chat/sessions')
      .set('Authorization', `Bearer ${blockedToken}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'PLAN_AI_REQUIRED' },
    });
    expect(prismaMock.aIChatSession.create).not.toHaveBeenCalled();
  });

  it('retorna erro SSE quando a quota bloqueia o turno', async () => {
    const session = createSession(tenant, user);
    const userMessage = createMessage(session, AIChatMessageRole.USER, 'Resumo');

    prismaMock.aIChatSession.findFirst.mockResolvedValue(session);
    prismaMock.aIChatMessage.create.mockResolvedValue(userMessage);
    prismaMock.aIChatMessage.findMany.mockResolvedValue([userMessage]);
    aiMock.assistantService.streamTurn.mockImplementation(() =>
      streamEvents([
        {
          type: 'error',
          message: 'Tenant excedeu o budget mensal de IA.',
          code: 'AI_QUOTA_EXCEEDED',
        },
      ]),
    );

    const response = await request(app)
      .post(`/api/v1/ai/chat/sessions/${session.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Resumo do mês' });

    expect(response.status).toBe(200);
    expect(parseSseEvents(response.text)).toEqual([
      {
        event: 'error',
        data: {
          type: 'error',
          message: 'Tenant excedeu o budget mensal de IA.',
          code: 'AI_QUOTA_EXCEEDED',
        },
      },
    ]);
  });

  it('aplica rate limit de 30 mensagens por minuto por tenant', async () => {
    const session = createSession(tenant, user);
    const userMessage = createMessage(session, AIChatMessageRole.USER, 'Pergunta');
    const assistantMessage = createMessage(
      session,
      AIChatMessageRole.ASSISTANT,
      'Resposta mockada.',
    );

    prismaMock.aIChatSession.findFirst.mockResolvedValue(session);
    prismaMock.aIChatMessage.create
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValue(assistantMessage);
    prismaMock.aIChatMessage.findMany.mockResolvedValue([userMessage]);
    prismaMock.aIChatSession.update.mockResolvedValue(session);
    aiMock.assistantService.streamTurn.mockImplementation(() =>
      streamEvents([
        { type: 'delta', text: 'ok' },
        {
          type: 'done',
          finalText: 'ok',
          usage: { inputTokens: 1, outputTokens: 1 },
          iterations: 1,
        },
      ]),
    );

    for (let index = 0; index < 30; index += 1) {
      const response = await request(app)
        .post(`/api/v1/ai/chat/sessions/${session.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: `Pergunta ${index}` });

      expect(response.status).toBe(200);
    }

    const blockedResponse = await request(app)
      .post(`/api/v1/ai/chat/sessions/${session.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Pergunta bloqueada' });

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body).toMatchObject({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS' },
    });
  });
});
