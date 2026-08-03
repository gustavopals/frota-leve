import { aiClient } from '../client';
import { AssistantService, type AssistantStreamEvent } from './assistant.service';
import type { AiToolDefinition } from '../types';

jest.mock('../client', () => ({ aiClient: { invoke: jest.fn() } }));

const invoke = aiClient.invoke as unknown as jest.Mock;

const TOOLS: AiToolDefinition[] = [
  {
    name: 'getTopCostVehicles',
    description: 'Top veículos por custo.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    model: 'claude-sonnet-5',
    systemPrompt: 'Você é um assistente de frota.',
    history: [],
    userMessage: 'Qual veículo gastou mais?',
    tools: TOOLS,
    toolExecutor: jest.fn().mockResolvedValue({ vehicles: [] }),
    ...overrides,
  };
}

async function collect(generator: AsyncGenerator<AssistantStreamEvent>) {
  const events: AssistantStreamEvent[] = [];

  for await (const event of generator) {
    events.push(event);
  }

  return events;
}

describe('AssistantService.streamTurn', () => {
  let service: AssistantService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssistantService();
  });

  it('responde direto quando o roteamento não pede tool', async () => {
    invoke
      .mockResolvedValueOnce({ data: {}, usage: { inputTokens: 10, outputTokens: 2 } })
      .mockResolvedValueOnce({ data: { text: 'Foi o ABC1D23.' }, usage: {} });

    const events = await collect(service.streamTurn(baseParams()));

    expect(events.some((event) => event.type === 'tool_use')).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: 'done', finalText: 'Foi o ABC1D23.' });
  });

  it('emite tool_use e tool_result quando o roteamento aciona uma tool', async () => {
    invoke
      .mockResolvedValueOnce({
        data: { toolUses: [{ id: 't1', name: 'getTopCostVehicles', input: {} }] },
        usage: {},
      })
      .mockResolvedValueOnce({ data: {}, usage: {} })
      .mockResolvedValueOnce({ data: { text: 'Resposta final.' }, usage: {} });

    const events = await collect(service.streamTurn(baseParams()));

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool_use', name: 'getTopCostVehicles' }),
        expect.objectContaining({ type: 'tool_result', name: 'getTopCostVehicles', ok: true }),
      ]),
    );
  });

  it('marca ok=false quando a tool falha, sem derrubar o turno', async () => {
    const toolExecutor = jest.fn().mockRejectedValue(new Error('timeout no banco'));

    invoke
      .mockResolvedValueOnce({
        data: { toolUses: [{ id: 't1', name: 'getTopCostVehicles', input: {} }] },
        usage: {},
      })
      .mockResolvedValueOnce({ data: {}, usage: {} })
      .mockResolvedValueOnce({ data: { text: 'Segue o que consegui.' }, usage: {} });

    const events = await collect(service.streamTurn(baseParams({ toolExecutor })));

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool_result', ok: false }),
        expect.objectContaining({ type: 'done' }),
      ]),
    );
  });

  it('usa a resposta padrão quando o modelo não devolve texto', async () => {
    invoke
      .mockResolvedValueOnce({ data: {}, usage: {} })
      .mockResolvedValueOnce({ data: {}, rawText: '', usage: {} });

    const events = await collect(service.streamTurn(baseParams()));

    expect(events.at(-1)).toMatchObject({ type: 'done', finalText: 'Não tenho esse dado.' });
  });

  it('emite evento de erro quando a IA falha', async () => {
    invoke.mockRejectedValue(new Error('falha de rede'));

    const events = await collect(service.streamTurn(baseParams()));

    expect(events.at(-1)).toMatchObject({ type: 'error' });
  });

  it('acumula o uso das duas etapas no evento done', async () => {
    invoke
      .mockResolvedValueOnce({ data: {}, usage: { inputTokens: 100, outputTokens: 20 } })
      .mockResolvedValueOnce({ data: { text: 'ok' }, usage: { inputTokens: 300, outputTokens: 80 } });

    const events = await collect(service.streamTurn(baseParams()));
    const done = events.at(-1);

    expect(done).toMatchObject({ type: 'done' });
    if (done?.type === 'done') {
      expect(done.usage.inputTokens).toBe(400);
      expect(done.usage.outputTokens).toBe(100);
    }
  });

  it('roteia com Haiku e responde com o modelo pedido', async () => {
    invoke
      .mockResolvedValueOnce({ data: {}, usage: {} })
      .mockResolvedValueOnce({ data: { text: 'ok' }, usage: {} });

    await collect(service.streamTurn(baseParams({ model: 'claude-opus-5' })));

    expect(invoke.mock.calls[0]?.[0]?.model).toBe('claude-haiku-4-5-20251001');
    expect(invoke.mock.calls[1]?.[0]?.model).toBe('claude-opus-5');
  });

  it('desliga o raciocínio na resposta final para preservar o max_tokens', async () => {
    invoke
      .mockResolvedValueOnce({ data: {}, usage: {} })
      .mockResolvedValueOnce({ data: { text: 'ok' }, usage: {} });

    await collect(service.streamTurn(baseParams()));

    expect(invoke.mock.calls[1]?.[0]).toMatchObject({
      thinking: 'disabled',
      toolChoice: { type: 'none' },
    });
  });
});
