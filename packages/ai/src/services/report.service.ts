import { AIReportKind, AIReportStatus, type Prisma, prisma } from '@frota-leve/database';
import { aiClient } from '../client';
import { buildMonthlyAggregates } from '../context/monthly-aggregates';
import type { MonthlyReportData } from '../context/monthly-aggregates.types';
import { AI_MODEL_HAIKU, AI_MODEL_SONNET } from '../models';
import {
  REPORT_MIN_LENGTH,
  REPORT_REQUIRED_HEADINGS,
  REPORT_SYSTEM_PROMPT_V1,
} from '../prompts/system/report.v1';
import { buildDegradedReportMarkdown, buildDegradedSummary } from './report.markdown';

const REPORT_MAX_TOKENS = 4000;
const SUMMARY_MAX_TOKENS = 300;
const MAX_ATTEMPTS = 3;

export interface GenerateReportParams {
  tenantId: string;
  period: string;
  kind?: AIReportKind;
  userId?: string;
}

export interface ReportValidationResult {
  valid: boolean;
  missingHeadings: string[];
  tooShort: boolean;
}

/**
 * Valida a narrativa (TASK 3.5.2, passo 6).
 *
 * Exige as seções acordadas e um tamanho mínimo — um markdown com os headings
 * certos mas praticamente vazio não serve como relatório executivo.
 */
export function validateReportContent(content: string): ReportValidationResult {
  const missingHeadings = REPORT_REQUIRED_HEADINGS.filter(
    (heading) => !content.includes(`## ${heading}`),
  );

  const tooShort = content.trim().length < REPORT_MIN_LENGTH;

  return { valid: missingHeadings.length === 0 && !tooShort, missingHeadings, tooShort };
}

function extractText(data: unknown, rawText?: string): string {
  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    const text = (data as Record<string, unknown>)['text'];

    if (typeof text === 'string') {
      return text;
    }
  }

  return rawText ?? '';
}

export class ReportService {
  /**
   * Gera o relatório do período (TASK 3.5.2).
   *
   * Idempotente: um `AIReport` já GENERATED para `tenantId+period+kind` é
   * devolvido sem reprocessar — rodar o job duas vezes não duplica nem gasta
   * token de novo.
   */
  async generateMonthly(params: GenerateReportParams) {
    const kind = params.kind ?? AIReportKind.MONTHLY;
    const { tenantId, period } = params;

    const existing = await prisma.aIReport.findFirst({
      where: { tenantId, period, kind, status: AIReportStatus.GENERATED },
    });

    if (existing) {
      return existing;
    }

    const data = await buildMonthlyAggregates(tenantId, period);
    const snapshot = data as unknown as Prisma.InputJsonValue;

    // Marca PENDING antes de chamar a IA: se o processo morrer no meio, o
    // registro mostra que a geração foi tentada em vez de sumir.
    await prisma.aIReport.upsert({
      where: { tenantId_period_kind: { tenantId, period, kind } },
      create: {
        tenantId,
        period,
        kind,
        content: '',
        summary: '',
        dataSnapshot: snapshot,
        status: AIReportStatus.PENDING,
      },
      update: { dataSnapshot: snapshot, status: AIReportStatus.PENDING },
    });

    const narrative = await this.generateNarrative(params, data);
    const degraded = narrative === null;
    const content = narrative ?? buildDegradedReportMarkdown(data);
    const summary = degraded
      ? buildDegradedSummary(data)
      : ((await this.generateSummary(params, content)) ?? buildDegradedSummary(data));

    return prisma.aIReport.update({
      where: { tenantId_period_kind: { tenantId, period, kind } },
      data: {
        content,
        summary,
        status: AIReportStatus.GENERATED,
        generatedAt: new Date(),
        dataSnapshot: { ...data, degraded } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Tenta a narrativa no Sonnet até 3 vezes. Devolve `null` quando todas as
   * tentativas falham ou a saída não passa na validação — o chamador cai no
   * relatório tabular (TASK 3.5.4).
   */
  private async generateNarrative(
    params: GenerateReportParams,
    data: MonthlyReportData,
  ): Promise<string | null> {
    if (process.env.AI_ENABLED !== 'true') {
      return null;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await aiClient.invoke<unknown>({
          tenantId: params.tenantId,
          userId: params.userId,
          feature: 'report',
          model: AI_MODEL_SONNET,
          system: REPORT_SYSTEM_PROMPT_V1,
          // O system prompt é estável entre tenants: marcar como cacheável
          // aproveita o prompt caching entre relatórios do mesmo ciclo.
          messages: [{ role: 'user', content: JSON.stringify(data), cacheable: false }],
          maxTokens: REPORT_MAX_TOKENS,
          thinking: 'disabled',
          effort: 'low',
        });

        const content = extractText(result.data, result.rawText).trim();

        if (validateReportContent(content).valid) {
          return content;
        }
      } catch {
        // Silencioso de propósito: a decisão de degradar é tomada ao fim do laço.
      }
    }

    return null;
  }

  /** Resumo de 2-3 frases via Haiku (TASK 3.5.2, passo 7). */
  private async generateSummary(
    params: GenerateReportParams,
    content: string,
  ): Promise<string | null> {
    try {
      const result = await aiClient.invoke<unknown>({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: 'report',
        model: AI_MODEL_HAIKU,
        system:
          'Resuma o relatório de frota em 2 a 3 frases objetivas em português do Brasil. ' +
          'Sem markdown, sem saudação.',
        messages: [{ role: 'user', content }],
        maxTokens: SUMMARY_MAX_TOKENS,
      });

      const summary = extractText(result.data, result.rawText).trim();

      return summary.length > 0 ? summary : null;
    } catch {
      return null;
    }
  }
}

export const reportService = new ReportService();
