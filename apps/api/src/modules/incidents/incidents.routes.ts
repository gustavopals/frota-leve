import { Router } from 'express';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { incidentUpload } from '../../middlewares/incident-upload';
import { IncidentsController } from './incidents.controller';
import {
  createIncidentBodySchema,
  incidentIdParamSchema,
  incidentStatsQuerySchema,
  listIncidentsQuerySchema,
  updateIncidentBodySchema,
} from './incidents.validators';

const incidentsController = new IncidentsController();

export const incidentsRouter = Router();

// Rota de upload de arquivos (fotos e documentos do sinistro) — auth requerida
incidentsRouter.post(
  '/uploads',
  authenticate,
  tenantMiddleware,
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  (req, res, next) => {
    incidentUpload(req, res, (err) => {
      if (err) {
        next(err);
        return;
      }
      next();
    });
  },
  (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const urls = files.map((f) => `${baseUrl}/uploads/incidents/${f.filename}`);
    res.status(200).json({ urls });
  },
);

incidentsRouter.use(authenticate, tenantMiddleware);

incidentsRouter.get('/', validate({ query: listIncidentsQuerySchema }), incidentsController.list);

incidentsRouter.get(
  '/stats',
  validate({ query: incidentStatsQuerySchema }),
  incidentsController.stats,
);

incidentsRouter.post(
  '/',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createIncidentBodySchema }),
  incidentsController.create,
);

incidentsRouter.get(
  '/:id',
  validate({ params: incidentIdParamSchema }),
  incidentsController.getById,
);

incidentsRouter.put(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: incidentIdParamSchema, body: updateIncidentBodySchema }),
  incidentsController.update,
);

incidentsRouter.delete(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: incidentIdParamSchema }),
  incidentsController.remove,
);
