import { FuelType, IncidentType } from '@frota-leve/shared';
import {
  mobileChecklistExecutionSchema,
  mobileFuelRecordSchema,
  mobileProblemSchema,
  signResponsibilityTermSchema,
} from './mobile.validators';

describe('mobile validators', () => {
  it('normaliza o abastecimento e mantém somente dados permitidos ao motorista', () => {
    const result = mobileFuelRecordSchema.parse({
      date: '2026-08-03T10:30:00.000Z',
      mileage: 12_300,
      liters: 40,
      pricePerLiter: 6.25,
      totalCost: 250,
      fuelType: FuelType.GASOLINE,
      vehicleId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      driverId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    });

    expect(result.date).toEqual(new Date('2026-08-03T10:30:00.000Z'));
    expect(result.fullTank).toBe(true);
    expect(result).not.toHaveProperty('vehicleId');
    expect(result).not.toHaveProperty('driverId');
  });

  it('rejeita checklist sem itens e assinatura fora de URL', () => {
    expect(() =>
      mobileChecklistExecutionSchema.parse({
        templateId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        executedAt: new Date(),
        signatureUrl: 'arquivo-local',
        items: [],
      }),
    ).toThrow();
  });

  it('aceita OK para item conforme e rejeita o status consolidado COMPLIANT', () => {
    const base = {
      templateId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      executedAt: new Date(),
      items: [
        {
          checklistItemId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
          status: 'OK',
        },
      ],
    };

    expect(mobileChecklistExecutionSchema.safeParse(base).success).toBe(true);
    expect(
      mobileChecklistExecutionSchema.safeParse({
        ...base,
        items: [{ ...base.items[0], status: 'COMPLIANT' }],
      }).success,
    ).toBe(false);
  });

  it('limita fotos de ocorrência e valida o tipo', () => {
    const base = {
      date: new Date(),
      location: '-23.5505, -46.6333',
      type: IncidentType.OTHER,
      description: 'Falha mecânica durante o trajeto',
      photos: Array.from({ length: 6 }, (_, index) => `https://files.test/${index}.jpg`),
    };

    expect(mobileProblemSchema.safeParse(base).success).toBe(false);
    expect(mobileProblemSchema.safeParse({ ...base, photos: [], type: 'UNKNOWN' }).success).toBe(
      false,
    );
  });

  it('exige uma URL de assinatura digital', () => {
    expect(signResponsibilityTermSchema.safeParse({ signatureUrl: 'assinatura' }).success).toBe(
      false,
    );
    expect(
      signResponsibilityTermSchema.safeParse({
        signatureUrl: 'https://api.frotafy.test/uploads/mobile/signature.png',
        location: '-23.5505, -46.6333',
      }).success,
    ).toBe(true);
  });
});
