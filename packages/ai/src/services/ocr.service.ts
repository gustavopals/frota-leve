import sharp from 'sharp';
import { aiClient } from '../client';
import { AI_MODEL_HAIKU } from '../models';
import { OCR_SYSTEM_PROMPT_V1 } from '../prompts/system/ocr.v1';
import { OCR_FUEL_TOOL, ocrFuelResultSchema, type OcrFuelResult } from '../tools/ocr-fuel.tool';
import {
  OCR_INVOICE_TOOL,
  ocrInvoiceResultSchema,
  type OcrInvoiceResult,
} from '../tools/ocr-invoice.tool';
import type { AiPromptImage } from '../types';

export type OcrKind = 'fuel' | 'invoice';

/** MIMEs aceitos (TASK 3.6.2). */
export const OCR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const OCR_MAX_BYTES = 5 * 1024 * 1024;
/** Lado maior após o downscale — reduz custo sem perder legibilidade do cupom. */
export const OCR_MAX_DIMENSION = 1568;
const OCR_MAX_TOKENS = 1500;

export interface OcrExtractParams {
  tenantId: string;
  userId?: string;
  kind: OcrKind;
  mimeType: string;
  image: Buffer;
}

export interface OcrExtractResult {
  data: OcrFuelResult | OcrInvoiceResult | null;
  confidence: number;
  /** Preenchido quando a validação falha nas duas tentativas — o usuário revisa à mão. */
  rawText?: string;
}

export class OcrValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrValidationError';
  }
}

/** Valida MIME e tamanho antes de gastar qualquer processamento. */
export function assertValidImage(mimeType: string, image: Buffer): void {
  if (!OCR_ALLOWED_MIME_TYPES.includes(mimeType as (typeof OCR_ALLOWED_MIME_TYPES)[number])) {
    throw new OcrValidationError('Formato de imagem inválido. Envie JPEG, PNG ou WebP.');
  }

  if (image.byteLength > OCR_MAX_BYTES) {
    throw new OcrValidationError('Imagem acima de 5 MB.');
  }
}

/**
 * Reduz a imagem para no máximo 1568px no lado maior e normaliza para JPEG.
 *
 * `rotate()` sem argumento aplica a orientação EXIF, resolvendo foto tirada de
 * lado. `withoutEnlargement` evita esticar cupom pequeno, o que só aumentaria o
 * custo em tokens sem melhorar a leitura.
 */
export async function downscaleImage(image: Buffer): Promise<AiPromptImage> {
  const resized = await sharp(image)
    .rotate()
    .resize({
      width: OCR_MAX_DIMENSION,
      height: OCR_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return { mediaType: 'image/jpeg', base64: resized.toString('base64') };
}

export class OcrService {
  /**
   * Extrai dados estruturados de um cupom ou nota (TASK 3.6.2).
   *
   * Força a tool correspondente para garantir saída estruturada e valida com Zod.
   * Falhando o schema, tenta mais uma vez; falhando de novo devolve
   * `confidence: 0` com o texto bruto para revisão manual — nunca JSON malformado.
   *
   * A imagem só existe em memória: não é persistida em lugar nenhum (TASK 3.6.4).
   */
  async extract(params: OcrExtractParams): Promise<OcrExtractResult> {
    assertValidImage(params.mimeType, params.image);

    const tool = params.kind === 'fuel' ? OCR_FUEL_TOOL : OCR_INVOICE_TOOL;
    const schema = params.kind === 'fuel' ? ocrFuelResultSchema : ocrInvoiceResultSchema;
    const image = await downscaleImage(params.image);

    let lastRawText = '';

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await aiClient.invoke<unknown>({
          tenantId: params.tenantId,
          userId: params.userId,
          feature: 'ocr',
          model: AI_MODEL_HAIKU,
          system: OCR_SYSTEM_PROMPT_V1,
          messages: [
            {
              role: 'user',
              content:
                params.kind === 'fuel'
                  ? 'Extraia os dados deste cupom de abastecimento.'
                  : 'Extraia os dados desta nota fiscal de manutenção.',
              image,
              containsFreshImage: true,
            },
          ],
          tools: [tool],
          toolChoice: { type: 'tool', name: tool.name },
          maxTokens: OCR_MAX_TOKENS,
        });

        lastRawText = result.rawText ?? '';
        const parsed = schema.safeParse(result.data);

        if (parsed.success) {
          return { data: parsed.data, confidence: parsed.data.confidence };
        }
      } catch (error) {
        if (error instanceof OcrValidationError) {
          throw error;
        }
        // Demais falhas caem no retry e, esgotado, no retorno de baixa confiança.
      }
    }

    return { data: null, confidence: 0, rawText: lastRawText };
  }
}

export const ocrService = new OcrService();
