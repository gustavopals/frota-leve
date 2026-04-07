import { Router } from 'express';
import { HealthController } from './health.controller';

const router = Router();
const controller = new HealthController();

/** GET /api/v1/health — status da API */
router.get('/', controller.check);

export { router as healthRouter };
