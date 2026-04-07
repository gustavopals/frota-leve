import type { Request, Response } from 'express';
import { HealthService } from './health.service';

export class HealthController {
  private service = new HealthService();

  check = (_req: Request, res: Response): void => {
    const status = this.service.check();
    res.status(200).json(status);
  };
}
