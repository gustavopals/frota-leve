import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { AuthController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.validators';
import { forgotPasswordRateLimit, loginRateLimit, refreshRateLimit } from './auth.rate-limit';

const controller = new AuthController();

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), controller.register);
authRouter.post('/login', validate(loginSchema), loginRateLimit, controller.login);
authRouter.post('/refresh', validate(refreshSchema), refreshRateLimit, controller.refresh);
authRouter.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  forgotPasswordRateLimit,
  controller.forgotPassword,
);
authRouter.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
authRouter.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword,
);
authRouter.get('/me', authenticate, tenantMiddleware, controller.me);
