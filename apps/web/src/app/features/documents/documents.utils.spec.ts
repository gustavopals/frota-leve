import { DocumentStatus } from '@frota-leve/shared/src/enums/document-status.enum';
import { DocumentType } from '@frota-leve/shared/src/enums/document-type.enum';
import {
  buildDocumentCalendarMonth,
  formatDocumentDate,
  getDocumentDateKey,
  toIsoDateInputValue,
} from './documents.utils';
import type { DocumentRecord } from './documents.types';

function createDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'document-1',
    tenantId: 'tenant-1',
    vehicleId: 'vehicle-1',
    driverId: null,
    type: DocumentType.IPVA,
    description: 'IPVA 2099',
    expirationDate: '2099-06-15T00:00:00.000Z',
    alertDaysBefore: 30,
    cost: null,
    fileUrl: 'https://files.example.com/document.pdf',
    status: DocumentStatus.VALID,
    notes: null,
    createdAt: '2099-01-01T00:00:00.000Z',
    daysUntilExpiration: 30,
    vehicle: {
      id: 'vehicle-1',
      plate: 'ABC1234',
      brand: 'Ford',
      model: 'Transit',
      year: 2099,
    },
    driver: null,
    ...overrides,
  };
}

describe('documents.utils', () => {
  it('mantém a data literal de vencimento sem deslocar pelo timezone', () => {
    const expirationDate = '2099-06-15T00:00:00.000Z';

    expect(formatDocumentDate(expirationDate)).toBe('15/06/2099');
    expect(getDocumentDateKey(expirationDate)).toBe('2099-06-15');
    expect(toIsoDateInputValue(expirationDate)).toBe('2099-06-15');
  });

  it('agrupa o calendário pelo dia correto e calcula a primeira data em ordem cronológica', () => {
    const month = buildDocumentCalendarMonth(
      [
        createDocument({
          id: 'document-1',
          description: 'Seguro mensal',
          expirationDate: '2099-06-30T00:00:00.000Z',
          status: DocumentStatus.EXPIRING,
          daysUntilExpiration: 1,
        }),
        createDocument({
          id: 'document-2',
          description: 'Licenciamento',
          type: DocumentType.LICENSING,
          expirationDate: '2099-06-05T00:00:00.000Z',
          status: DocumentStatus.VALID,
          daysUntilExpiration: 26,
        }),
      ],
      new Date(2099, 5, 1),
      new Date(2099, 5, 10),
    );

    const targetDay = month.weeks
      .flatMap((week) => week.days)
      .find((day) => day.dateKey === '2099-06-30');

    expect(targetDay?.total).toBe(1);
    expect(month.firstDueDate).toBe('2099-06-05T00:00:00.000Z');
    expect(month.lastDueDate).toBe('2099-06-30T00:00:00.000Z');
  });
});
