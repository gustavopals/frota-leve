import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { aiFeatureFlag } from '../../middlewares/ai-feature-flag';
import { requireAI } from '../../middlewares/require-ai';
import { aiFeatureToggle } from '../../middlewares/ai-feature-toggle';
import { validate } from '../../middlewares/validate';
import { AIController } from './ai.controller';
import { usageQuerySchema } from './ai.validators';
import { anomalyRouter } from './anomaly/anomaly.routes';
import { chatRouter } from './chat/chat.routes';
import { ocrRouter } from './ocr/ocr.routes';
import { reportsRouter } from './reports/reports.routes';
import { scoringRouter } from './scoring/scoring.routes';
import { aiSettingsRouter } from './settings/ai-settings.routes';

const aiController = new AIController();

export const aiRouter = Router();

// Feature flag global → autenticação → tenant → checagem de plano IA
aiRouter.use(aiFeatureFlag, authenticate, tenantMiddleware, requireAI);

aiRouter.get(
  '/usage',
  authorize('OWNER', 'ADMIN'),
  validate({ query: usageQuerySchema }),
  aiController.getUsage,
);

aiRouter.get('/quota', authorize('OWNER', 'ADMIN'), aiController.getQuota);

// Sub-router de chat (assistente conversacional).
// Permitido para qualquer role autenticada do tenant — limites são por sessão/usuário.
aiRouter.use('/chat', aiFeatureToggle('chat'), chatRouter);

// Anomalias detectadas pelas regras determinísticas (TASK 3.4).
aiRouter.use('/anomalies', aiFeatureToggle('anomalies'), anomalyRouter);

// Relatórios mensais e sob demanda (TASK 3.5).
aiRouter.use('/reports', aiFeatureToggle('reports'), reportsRouter);

// OCR de cupons e notas fiscais (TASK 3.6).
aiRouter.use('/ocr', aiFeatureToggle('ocr'), ocrRouter);

// Scoring de motoristas (TASK 3.7).
aiRouter.use('/scoring', aiFeatureToggle('scoring'), scoringRouter);

// Painel administrativo de IA (TASK 3.8). Sem toggle: e onde se religa o resto.
aiRouter.use('/settings', aiSettingsRouter);
