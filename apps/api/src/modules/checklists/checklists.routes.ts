import { Router } from 'express';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { ChecklistsController } from './checklists.controller';
import {
  checklistComplianceQuerySchema,
  checklistTemplateIdParamSchema,
  createChecklistExecutionBodySchema,
  createChecklistTemplateBodySchema,
  listChecklistExecutionsQuerySchema,
  listChecklistTemplatesQuerySchema,
  replaceChecklistTemplateBodySchema,
} from './checklists.validators';

const controller = new ChecklistsController();

export const checklistsRouter = Router();

checklistsRouter.use(authenticate, tenantMiddleware);

checklistsRouter.get(
  '/templates',
  validate({ query: listChecklistTemplatesQuerySchema }),
  controller.listTemplates,
);

checklistsRouter.get(
  '/executions',
  validate({ query: listChecklistExecutionsQuerySchema }),
  controller.listExecutions,
);

checklistsRouter.post(
  '/templates',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createChecklistTemplateBodySchema }),
  controller.createTemplate,
);

checklistsRouter.post(
  '/execute',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER),
  validate({ body: createChecklistExecutionBodySchema }),
  controller.executeChecklist,
);

checklistsRouter.get(
  '/compliance',
  validate({ query: checklistComplianceQuerySchema }),
  controller.compliance,
);

checklistsRouter.get(
  '/templates/:id',
  validate({ params: checklistTemplateIdParamSchema }),
  controller.getTemplateById,
);

checklistsRouter.put(
  '/templates/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: checklistTemplateIdParamSchema, body: replaceChecklistTemplateBodySchema }),
  controller.replaceTemplate,
);

checklistsRouter.delete(
  '/templates/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: checklistTemplateIdParamSchema }),
  controller.removeTemplate,
);
