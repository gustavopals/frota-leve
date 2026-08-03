import { randomUUID } from 'node:crypto';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';

export interface MonthlyReportRecipient {
  id: string;
  name: string;
  email: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** E-mail do relatório mensal (TASK 3.5.5). Mesmo padrão Resend do resto do app. */
export class ReportEmailService {
  async sendMonthlyReport(params: {
    recipient: MonthlyReportRecipient;
    period: string;
    summary: string;
    reportUrl: string;
  }): Promise<void> {
    const subject = `Relatório de frota de ${params.period}`;
    const html = this.buildHtml(params);

    if (!env.RESEND_API_KEY) {
      logger.info('E-mail de relatório mensal gerado em modo fallback.', {
        email: params.recipient.email,
        subject,
      });
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
        to: [params.recipient.email],
        subject: `${subject} - Frota Leve`,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao enviar relatório mensal via Resend: ${response.status}`);
    }
  }

  private buildHtml(params: {
    recipient: MonthlyReportRecipient;
    period: string;
    summary: string;
    reportUrl: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head><meta charset="UTF-8" /><title>Relatório de frota</title></head>
        <body style="margin: 0; padding: 24px; background: #f8fafc;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto;">
            <tr>
              <td>
                <div style="font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0f766e;">Frota Leve</div>
                <h1 style="font-family: Arial, sans-serif; font-size: 26px; color: #0f172a; margin: 10px 0 16px;">
                  Relatório de ${escapeHtml(params.period)}
                </h1>
                <p style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #475569;">
                  ${escapeHtml(params.recipient.name)}, o relatório do período está pronto.
                </p>
                <p style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #0f172a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;">
                  ${escapeHtml(params.summary)}
                </p>
                <p style="margin-top: 20px;">
                  <a href="${escapeHtml(params.reportUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #0f172a; color: #ffffff; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none;">
                    Ver relatório completo
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }
}

export const reportEmailService = new ReportEmailService();
