import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export type CriticalNotificationEmailRecipient = {
  id: string;
  name: string;
  email: string;
  companyName: string;
};

export type CriticalNotificationEmailAlert = {
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatReferenceDate(referenceDate: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(referenceDate);
}

export class NotificationEmailService {
  async sendCriticalAlertDigest(params: {
    recipient: CriticalNotificationEmailRecipient;
    alerts: CriticalNotificationEmailAlert[];
    referenceDate: Date;
  }): Promise<void> {
    if (params.alerts.length === 0) {
      return;
    }

    const subject =
      params.alerts.length === 1
        ? '1 alerta crítico exige atenção imediata'
        : `${params.alerts.length} alertas críticos exigem atenção imediata`;
    const html = this.buildCriticalAlertDigest(params);

    if (!env.RESEND_API_KEY) {
      logger.info('E-mail de alerta crítico gerado em modo fallback.', {
        email: params.recipient.email,
        subject,
        html,
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
      throw new Error(`Falha ao enviar e-mail de alerta crítico via Resend: ${response.status}`);
    }
  }

  private buildCriticalAlertDigest(params: {
    recipient: CriticalNotificationEmailRecipient;
    alerts: CriticalNotificationEmailAlert[];
    referenceDate: Date;
  }): string {
    const recipientName = escapeHtml(params.recipient.name);
    const companyName = escapeHtml(params.recipient.companyName);
    const referenceDate = escapeHtml(formatReferenceDate(params.referenceDate));
    const alertCountLabel =
      params.alerts.length === 1 ? '1 alerta crítico' : `${params.alerts.length} alertas críticos`;

    const alertsHtml = params.alerts
      .map(
        (alert) => `
          <tr>
            <td style="padding: 0 0 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-radius: 14px; background: #ffffff;">
                <tr>
                  <td style="padding: 18px 18px 14px;">
                    <div style="font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #c2410c;">Crítico</div>
                    <div style="font-family: Arial, sans-serif; font-size: 18px; font-weight: 700; line-height: 1.35; color: #0f172a; margin-top: 8px;">
                      ${escapeHtml(alert.title)}
                    </div>
                    <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #475569; margin-top: 10px;">
                      ${escapeHtml(alert.message)}
                    </div>
                    <div style="margin-top: 16px;">
                      <a href="${escapeHtml(alert.actionUrl)}" style="display: inline-block; padding: 10px 14px; border-radius: 999px; background: #0f172a; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; text-decoration: none;">
                        ${escapeHtml(alert.actionLabel)}
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Alertas críticos - Frota Leve</title>
        </head>
        <body style="margin: 0; padding: 24px; background: #f8fafc;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; margin: 0 auto; border-collapse: separate;">
            <tr>
              <td style="padding: 0 0 18px;">
                <div style="font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #c2410c;">Frota Leve</div>
                <div style="font-family: Arial, sans-serif; font-size: 28px; font-weight: 700; line-height: 1.15; color: #0f172a; margin-top: 10px;">
                  ${escapeHtml(alertCountLabel)} precisam de ação
                </div>
                <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #475569; margin-top: 14px;">
                  ${recipientName}, identificamos pendências críticas em ${companyName} na varredura de ${referenceDate}.
                </div>
              </td>
            </tr>
            ${alertsHtml}
            <tr>
              <td style="padding-top: 4px;">
                <div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #64748b;">
                  Este aviso foi enviado automaticamente porque a sua conta recebe alertas críticos operacionais.
                </div>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }
}

export const notificationEmailService = new NotificationEmailService();
