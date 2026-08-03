import { Router } from 'express';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { mobileUpload } from '../../middlewares/mobile-upload';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { MobileController } from './mobile.controller';
import {
  mobileChecklistExecutionSchema,
  mobileFuelRecordSchema,
  mobileProblemSchema,
  responsibilityTermIdSchema,
  signResponsibilityTermSchema,
} from './mobile.validators';
import type { NextFunction, Request, Response } from 'express';

const controller = new MobileController();

export const mobileRouter = Router();

mobileRouter.use(authenticate, tenantMiddleware, authorize(UserRole.DRIVER));

mobileRouter.get('/context', controller.context);
mobileRouter.get('/checklist-templates', controller.listChecklistTemplates);
mobileRouter.post(
  '/checklist-executions',
  validate({ body: mobileChecklistExecutionSchema }),
  controller.executeChecklist,
);
mobileRouter.post(
  '/fuel-records',
  validate({ body: mobileFuelRecordSchema }),
  controller.createFuelRecord,
);
mobileRouter.post('/problems', validate({ body: mobileProblemSchema }), controller.reportProblem);
mobileRouter.post(
  '/responsibility-terms/:id/sign',
  validate({ params: responsibilityTermIdSchema, body: signResponsibilityTermSchema }),
  controller.signResponsibilityTerm,
);

mobileRouter.post(
  '/uploads',
  (req: Request, res: Response, next: NextFunction): void => {
    mobileUpload(req, res, (error: unknown) => {
      if (error) next(error);
      else next();
    });
  },
  (req: Request, res: Response): void => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'Selecione uma imagem' },
      });
      return;
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({
      success: true,
      data: { url: `${baseUrl}/uploads/mobile/${req.file.filename}` },
    });
  },
);
