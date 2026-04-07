import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { authService } from './auth.service';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.validators';

export class AuthController {
  register = (req: Request, res: Response, next: NextFunction): void => {
    void authService
      .register(req.body as RegisterInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  login = (req: Request, res: Response, next: NextFunction): void => {
    void authService
      .login(req.body as LoginInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  refresh = (req: Request, res: Response, next: NextFunction): void => {
    void authService
      .refresh(req.body as RefreshInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  forgotPassword = (req: Request, res: Response, next: NextFunction): void => {
    void authService
      .forgotPassword(req.body as ForgotPasswordInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  resetPassword = (req: Request, res: Response, next: NextFunction): void => {
    void authService
      .resetPassword(req.body as ResetPasswordInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  changePassword = (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id;

    if (!userId) {
      next(new UnauthorizedError('Usuário não autenticado'));
      return;
    }

    void authService
      .changePassword(userId, req.body as ChangePasswordInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  me = (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id;

    if (!userId) {
      next(new UnauthorizedError('Usuário não autenticado'));
      return;
    }

    void authService
      .getMe(userId)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
