import sharp from 'sharp';
import { aiClient } from '../client';
import {
  OCR_MAX_DIMENSION,
  OcrService,
  OcrValidationError,
  assertValidImage,
  downscaleImage,
} from './ocr.service';

jest.mock('../client', () => ({ aiClient: { invoke: jest.fn() } }));

const invoke = aiClient.invoke as unknown as jest.Mock;

/** Cupom sintético: retângulo sólido com as dimensões pedidas. */
async function syntheticImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .jpeg()
    .toBuffer();
}

function validFuelPayload(overrides: Record<string, unknown> = {}) {
  return {
    liters: 42.5,
    totalCost: 300.25,
    pricePerLiter: 7.06,
    gasStation: 'Posto Teste',
    fuelType: 'DIESEL_S10',
    date: '2026-07-15T10:30:00.000Z',
    odometerKm: 84210,
    cnpj: '12345678000199',
    confidence: 0.93,
    fieldsConfidence: { liters: 0.97, totalCost: 0.95 },
    ...overrides,
  };
}

describe('assertValidImage', () => {
  it('aceita os MIMEs suportados', async () => {
    const image = await syntheticImage(100, 100);

    expect(() => assertValidImage('image/jpeg', image)).not.toThrow();
    expect(() => assertValidImage('image/png', image)).not.toThrow();
    expect(() => assertValidImage('image/webp', image)).not.toThrow();
  });

  it('recusa MIME não suportado', async () => {
    const image = await syntheticImage(100, 100);

    expect(() => assertValidImage('application/pdf', image)).toThrow(OcrValidationError);
  });

  it('recusa imagem acima de 5 MB', () => {
    const huge = Buffer.alloc(5 * 1024 * 1024 + 1);

    expect(() => assertValidImage('image/jpeg', huge)).toThrow(/5 MB/);
  });
});

describe('downscaleImage', () => {
  it('reduz o lado maior para o teto configurado', async () => {
    const image = await syntheticImage(3000, 1500);

    const result = await downscaleImage(image);
    const metadata = await sharp(Buffer.from(result.base64, 'base64')).metadata();

    expect(metadata.width).toBe(OCR_MAX_DIMENSION);
    expect(result.mediaType).toBe('image/jpeg');
  });

  it('não amplia imagem menor que o teto', async () => {
    const image = await syntheticImage(400, 300);

    const metadata = await sharp(
      Buffer.from((await downscaleImage(image)).base64, 'base64'),
    ).metadata();

    expect(metadata.width).toBe(400);
  });

  it('normaliza PNG para JPEG', async () => {
    const png = await sharp({
      create: { width: 200, height: 200, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();

    const metadata = await sharp(
      Buffer.from((await downscaleImage(png)).base64, 'base64'),
    ).metadata();

    expect(metadata.format).toBe('jpeg');
  });
});

describe('OcrService.extract', () => {
  let service: OcrService;
  let image: Buffer;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new OcrService();
    image = await syntheticImage(800, 1200);
  });

  it('extrai cupom nítido com alta confiança', async () => {
    invoke.mockResolvedValue({ data: validFuelPayload() });

    const result = await service.extract({
      tenantId: 't1',
      kind: 'fuel',
      mimeType: 'image/jpeg',
      image,
    });

    expect(result.confidence).toBeCloseTo(0.93);
    expect(result.data).toMatchObject({ liters: 42.5, totalCost: 300.25 });
  });

  it('força a tool ocrFuel e envia a imagem no prompt', async () => {
    invoke.mockResolvedValue({ data: validFuelPayload() });

    await service.extract({ tenantId: 't1', kind: 'fuel', mimeType: 'image/jpeg', image });

    const call = invoke.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      feature: 'ocr',
      toolChoice: { type: 'tool', name: 'ocrFuel' },
    });
    expect(call.messages[0].image.mediaType).toBe('image/jpeg');
  });

  it('aceita cupom desfocado com confiança baixa sem descartar os dados', async () => {
    invoke.mockResolvedValue({
      data: validFuelPayload({ confidence: 0.32, fieldsConfidence: { liters: 0.3 } }),
    });

    const result = await service.extract({
      tenantId: 't1',
      kind: 'fuel',
      mimeType: 'image/jpeg',
      image,
    });

    expect(result.confidence).toBeCloseTo(0.32);
    expect(result.data).not.toBeNull();
  });

  it('trata foto girada aplicando a orientação EXIF no downscale', async () => {
    const rotated = await sharp(await syntheticImage(1200, 800))
      .rotate(90)
      .jpeg()
      .toBuffer();
    invoke.mockResolvedValue({ data: validFuelPayload() });

    await expect(
      service.extract({ tenantId: 't1', kind: 'fuel', mimeType: 'image/jpeg', image: rotated }),
    ).resolves.toMatchObject({ confidence: 0.93 });
  });

  it('faz um retry quando a primeira resposta viola o schema', async () => {
    invoke
      .mockResolvedValueOnce({ data: { liters: 'quarenta', confidence: 2 }, rawText: 'ruído' })
      .mockResolvedValueOnce({ data: validFuelPayload() });

    const result = await service.extract({
      tenantId: 't1',
      kind: 'fuel',
      mimeType: 'image/jpeg',
      image,
    });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.data).not.toBeNull();
  });

  it('devolve confidence 0 e texto bruto quando as duas tentativas falham', async () => {
    invoke.mockResolvedValue({ data: { totalmente: 'invalido' }, rawText: 'texto ilegível' });

    const result = await service.extract({
      tenantId: 't1',
      kind: 'fuel',
      mimeType: 'image/jpeg',
      image,
    });

    expect(result).toMatchObject({ data: null, confidence: 0, rawText: 'texto ilegível' });
  });

  it('nunca propaga erro da IA como exceção', async () => {
    invoke.mockRejectedValue(new Error('quota estourada'));

    await expect(
      service.extract({ tenantId: 't1', kind: 'fuel', mimeType: 'image/jpeg', image }),
    ).resolves.toMatchObject({ confidence: 0 });
  });

  it('extrai nota fiscal com itens', async () => {
    invoke.mockResolvedValue({
      data: {
        supplier: 'Oficina Central',
        cnpj: '98765432000155',
        issueDate: '2026-07-10T00:00:00.000Z',
        totalValue: 1250.9,
        items: [{ description: 'Troca de óleo', qty: 1, unitValue: 250, totalValue: 250 }],
        taxes: 90.5,
        confidence: 0.88,
        fieldsConfidence: { totalValue: 0.9 },
      },
    });

    const result = await service.extract({
      tenantId: 't1',
      kind: 'invoice',
      mimeType: 'image/jpeg',
      image,
    });

    expect(invoke.mock.calls[0]?.[0]?.toolChoice).toMatchObject({ name: 'ocrInvoice' });
    expect(result.data).toMatchObject({ supplier: 'Oficina Central', totalValue: 1250.9 });
  });

  it('recusa a imagem antes de chamar a IA quando o MIME é inválido', async () => {
    await expect(
      service.extract({ tenantId: 't1', kind: 'fuel', mimeType: 'application/pdf', image }),
    ).rejects.toThrow(OcrValidationError);

    expect(invoke).not.toHaveBeenCalled();
  });
});
