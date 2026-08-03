import 'fake-indexeddb/auto';
import { MAX_SYNC_ATTEMPTS, OfflineQueueService } from './offline-queue.service';

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;

  beforeEach(async () => {
    localStorage.setItem(
      'frota-mobile.user',
      JSON.stringify({ id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' }),
    );
    service = new OfflineQueueService();
    const existing = await service.list();
    await Promise.all(existing.map((operation) => service.remove(operation.id)));
  });

  it('isola operações pendentes por motorista autenticado', async () => {
    await service.enqueue({
      type: 'fuel',
      payload: {
        date: '2026-08-03T12:00:00.000Z',
        mileage: 100,
        liters: 10,
        pricePerLiter: 6,
        totalCost: 60,
        fuelType: 'GASOLINE',
        fullTank: true,
        gasStation: null,
        notes: null,
      },
      receipt: null,
    });

    localStorage.setItem(
      'frota-mobile.user',
      JSON.stringify({ id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' }),
    );
    await service.refreshCount();

    expect(await service.list()).toEqual([]);
    expect(service.pendingCount()).toBe(0);
  });

  it('preserva dados e imagens de um abastecimento até a sincronização', async () => {
    const receipt = new Blob(['imagem'], { type: 'image/jpeg' });

    const id = await service.enqueue({
      type: 'fuel',
      payload: {
        date: '2026-08-03T12:00:00.000Z',
        mileage: 12_500,
        liters: 42,
        pricePerLiter: 6.1,
        totalCost: 256.2,
        fuelType: 'GASOLINE',
        fullTank: true,
        gasStation: 'Posto Central',
        notes: null,
      },
      receipt: { blob: receipt, fileName: 'comprovante.jpg' },
    });

    const [operation] = await service.list();

    expect(operation?.id).toBe(id);
    expect(operation?.type).toBe('fuel');
    expect(service.pendingCount()).toBe(1);
    if (operation?.type !== 'fuel') throw new Error('Operação de abastecimento não encontrada');
    expect(operation.receipt?.fileName).toBe('comprovante.jpg');
    expect(operation.receipt?.blob).toBeTruthy();
  });

  it('registra tentativas sem descartar a operação e remove depois do envio', async () => {
    const id = await service.enqueue({
      type: 'problem',
      payload: {
        date: '2026-08-03T12:00:00.000Z',
        location: '-23.5505, -46.6333',
        type: 'OTHER',
        description: 'Ruído anormal no motor',
        thirdPartyInvolved: false,
        policeReport: false,
      },
      photos: [],
    });

    const [queued] = await service.list();
    if (!queued) throw new Error('Operação offline não encontrada');
    await service.recordFailure(queued, 'Sem conexão');

    const [failed] = await service.list();
    expect(failed?.attempts).toBe(1);
    expect(failed?.lastError).toBe('Sem conexão');

    await service.remove(id);
    expect(await service.list()).toEqual([]);
    expect(service.pendingCount()).toBe(0);
  });

  it('para de reenviar depois do limite de tentativas, sem perder o dado', async () => {
    await service.enqueue({
      type: 'problem',
      payload: {
        date: '2026-08-03T12:00:00.000Z',
        location: '-23.5505, -46.6333',
        type: 'OTHER',
        description: 'Payload rejeitado pela validação',
        thirdPartyInvolved: false,
        policeReport: false,
      },
      photos: [],
    });

    // Falha permanente: o servidor devolve o mesmo erro toda vez.
    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      const [queued] = await service.listSyncable();
      if (!queued) throw new Error(`Operação saiu da fila cedo demais (tentativa ${attempt + 1})`);
      await service.recordFailure(queued, 'Veículo não vinculado ao motorista');
    }

    // Sai da fila automática: sem isso, reprocessaria a cada reconexão para sempre.
    expect(await service.listSyncable()).toEqual([]);
    expect(service.pendingCount()).toBe(0);

    // Mas continua guardada, com o motivo, aguardando decisão do motorista.
    const failed = await service.listFailed();
    expect(failed).toHaveLength(1);
    expect(service.failedCount()).toBe(1);
    expect(failed[0]?.lastError).toBe('Veículo não vinculado ao motorista');
    expect(failed[0]?.attempts).toBe(MAX_SYNC_ATTEMPTS);
  });

  it('devolve a operação à fila automática quando o motorista manda tentar de novo', async () => {
    await service.enqueue({
      type: 'problem',
      payload: {
        date: '2026-08-03T12:00:00.000Z',
        location: '-23.5505, -46.6333',
        type: 'OTHER',
        description: 'Falha temporária',
        thirdPartyInvolved: false,
        policeReport: false,
      },
      photos: [],
    });

    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      const [queued] = await service.listSyncable();
      if (!queued) throw new Error('Operação saiu da fila cedo demais');
      await service.recordFailure(queued, 'Timeout');
    }

    const [dead] = await service.listFailed();
    if (!dead) throw new Error('Operação esgotada não encontrada');
    await service.resetAttempts(dead.id);

    expect(await service.listSyncable()).toHaveLength(1);
    expect(service.failedCount()).toBe(0);
    expect(service.pendingCount()).toBe(1);
    expect((await service.list())[0]?.lastError).toBeNull();
  });
});
