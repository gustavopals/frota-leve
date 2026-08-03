import type { NextFunction, Request, Response } from 'express';
import { OcrValidationError, ocrService, type OcrKind } from '@frota-leve/ai';
import { UnauthorizedError, ValidationError } from '../../../shared/errors';

interface OcrActorContext {
  tenantId: string;
  userId: string;
}

export class OcrController {
  private getActorContext(req: Request): OcrActorContext {
    if (!req.tenant) {
      throw new UnauthorizedError('Tenant não identificado');
    }

    if (!req.user?.id) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    return { tenantId: req.tenant.id, userId: req.user.id };
  }

  private handle(kind: OcrKind) {
    return (req: Request, res: Response, next: NextFunction): void => {
      let context: OcrActorContext;

      try {
        context = this.getActorContext(req);
      } catch (error) {
        next(error);
        return;
      }

      const file = req.file;

      if (!file) {
        next(new ValidationError('Envie a imagem no campo "image".'));
        return;
      }

      void ocrService
        .extract({
          tenantId: context.tenantId,
          userId: context.userId,
          kind,
          mimeType: file.mimetype,
          image: file.buffer,
        })
        .then((result) => res.status(200).json({ success: true, data: result }))
        .catch((error: unknown) => {
          // A imagem vive só no buffer do multer e sai de escopo aqui (TASK 3.6.4).
          if (error instanceof OcrValidationError) {
            next(new ValidationError(error.message));
            return;
          }

          next(error);
        });
    };
  }

  extractFuel = this.handle('fuel');
  extractInvoice = this.handle('invoice');
}
