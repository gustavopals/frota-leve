import { Injectable, signal } from '@angular/core';
import type {
  ChecklistSubmission,
  FuelSubmission,
  ProblemSubmission,
} from '../models/mobile.models';
import { currentMobileUserId } from './auth.service';

const DB_NAME = 'frota-leve-mobile';
const DB_VERSION = 2;
const STORE_NAME = 'pending-operations';
const OWNER_INDEX = 'owner-user-id';

/**
 * Tentativas de sincronização antes de a operação parar de ser reprocessada.
 *
 * Sem esse corte, um envio que falha de forma permanente (payload rejeitado na
 * validação, veículo desvinculado do motorista, termo já assinado) volta a ser
 * tentado a cada reconexão para sempre, e o contador de pendentes nunca zera.
 * A operação não é descartada — dado preenchido pelo motorista não se joga fora
 * em silêncio; ela sai da fila automática e passa a exigir ação explícita.
 */
export const MAX_SYNC_ATTEMPTS = 5;

export interface StoredUpload {
  blob: Blob;
  fileName: string;
}

export type QueuedOperation =
  | {
      id: string;
      ownerUserId: string;
      type: 'checklist';
      createdAt: string;
      attempts: number;
      lastError: string | null;
      payload: ChecklistSubmission;
      itemPhotos: Array<{ checklistItemId: string; file: StoredUpload }>;
      signature: StoredUpload | null;
    }
  | {
      id: string;
      ownerUserId: string;
      type: 'fuel';
      createdAt: string;
      attempts: number;
      lastError: string | null;
      payload: FuelSubmission;
      receipt: StoredUpload | null;
    }
  | {
      id: string;
      ownerUserId: string;
      type: 'problem';
      createdAt: string;
      attempts: number;
      lastError: string | null;
      payload: ProblemSubmission;
      photos: StoredUpload[];
    }
  | {
      id: string;
      ownerUserId: string;
      type: 'term';
      createdAt: string;
      attempts: number;
      lastError: string | null;
      termId: string;
      location: string | null;
      signature: StoredUpload;
    };

type StripQueueMetadata<T> = T extends unknown
  ? Omit<T, 'id' | 'ownerUserId' | 'createdAt' | 'attempts' | 'lastError'>
  : never;

export type NewQueuedOperation = StripQueueMetadata<QueuedOperation>;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento offline'));
  });
}

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readonly pendingState = signal(0);
  private readonly failedState = signal(0);
  readonly pendingCount = this.pendingState.asReadonly();
  readonly failedCount = this.failedState.asReadonly();

  async enqueue(operation: NewQueuedOperation): Promise<string> {
    const ownerUserId = currentMobileUserId();
    if (!ownerUserId) throw new Error('Entre novamente para salvar dados offline');
    const item = {
      ...operation,
      id: crypto.randomUUID(),
      ownerUserId,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    } as QueuedOperation;
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).add(item));
    await this.refreshCount();
    return item.id;
  }

  async list(): Promise<QueuedOperation[]> {
    const ownerUserId = currentMobileUserId();
    if (!ownerUserId) return [];
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const items = await requestResult(
      transaction.objectStore(STORE_NAME).index(OWNER_INDEX).getAll(ownerUserId),
    );
    return (items as QueuedOperation[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Operações que ainda podem ser reenviadas automaticamente. */
  async listSyncable(): Promise<QueuedOperation[]> {
    const items = await this.list();
    return items.filter((item) => item.attempts < MAX_SYNC_ATTEMPTS);
  }

  /** Operações que esgotaram as tentativas e aguardam decisão do motorista. */
  async listFailed(): Promise<QueuedOperation[]> {
    const items = await this.list();
    return items.filter((item) => item.attempts >= MAX_SYNC_ATTEMPTS);
  }

  /** Zera as tentativas para que o motorista possa forçar um novo envio. */
  async resetAttempts(id: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const item = (await requestResult(store.get(id))) as QueuedOperation | undefined;
    if (!item) return;
    await requestResult(store.put({ ...item, attempts: 0, lastError: null }));
    await this.refreshCount();
  }

  async remove(id: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).delete(id));
    await this.refreshCount();
  }

  async recordFailure(operation: QueuedOperation, message: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(
      transaction.objectStore(STORE_NAME).put({
        ...operation,
        attempts: operation.attempts + 1,
        lastError: message,
      }),
    );
    // A contagem precisa ser refeita: ao cruzar o limite a operação migra de
    // "pendente" para "falhou", e o indicador da shell muda de estado.
    await this.refreshCount();
  }

  async refreshCount(): Promise<void> {
    const ownerUserId = currentMobileUserId();
    if (!ownerUserId) {
      this.pendingState.set(0);
      this.failedState.set(0);
      return;
    }
    const items = await this.list();
    this.pendingState.set(items.filter((item) => item.attempts < MAX_SYNC_ATTEMPTS).length);
    this.failedState.set(items.filter((item) => item.attempts >= MAX_SYNC_ATTEMPTS).length);
  }

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        let store: IDBObjectStore;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        } else {
          store = request.transaction?.objectStore(STORE_NAME) as IDBObjectStore;
        }
        if (!store.indexNames.contains(OWNER_INDEX)) {
          store.createIndex(OWNER_INDEX, 'ownerUserId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Falha ao abrir dados offline'));
    });

    return this.databasePromise;
  }
}
