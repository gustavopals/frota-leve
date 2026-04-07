import type { NextFunction, Request, Response } from 'express';
import { TooManyRequestsError, ValidationError } from '../../shared/errors';
import { authCache } from './auth.cache';

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_SECONDS = 60;
const FORGOT_PASSWORD_LIMIT = 3;
const FORGOT_PASSWORD_WINDOW_SECONDS = 60 * 60;
const REFRESH_LIMIT = 30;
const REFRESH_WINDOW_SECONDS = 60 * 60;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function createRateLimitMiddleware(params: {
  prefix: string;
  limit: number;
  windowSeconds: number;
  buildIdentifier: (req: Request) => string;
  message: string;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const identifier = params.buildIdentifier(req);
    const key = `${params.prefix}:${identifier}`;

    void authCache
      .increment(key, params.windowSeconds)
      .then((count) => {
        if (count > params.limit) {
          next(
            new TooManyRequestsError(params.message, {
              key,
              limit: params.limit,
              windowSeconds: params.windowSeconds,
            }),
          );
          return;
        }

        next();
      })
      .catch(next);
  };
}

export const loginRateLimit = createRateLimitMiddleware({
  prefix: 'auth:login',
  limit: LOGIN_LIMIT,
  windowSeconds: LOGIN_WINDOW_SECONDS,
  buildIdentifier: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  message: 'Muitas tentativas de login. Tente novamente em instantes.',
});

export const refreshRateLimit = createRateLimitMiddleware({
  prefix: 'auth:refresh',
  limit: REFRESH_LIMIT,
  windowSeconds: REFRESH_WINDOW_SECONDS,
  buildIdentifier: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  message: 'Muitas tentativas de refresh. Tente novamente mais tarde.',
});

export const forgotPasswordRateLimit = createRateLimitMiddleware({
  prefix: 'auth:forgot-password',
  limit: FORGOT_PASSWORD_LIMIT,
  windowSeconds: FORGOT_PASSWORD_WINDOW_SECONDS,
  buildIdentifier: (req) => {
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';

    if (!email) {
      throw new ValidationError('E-mail inválido para rate limit');
    }

    return email;
  },
  message: 'Muitas solicitações de recuperação de senha para este e-mail.',
});
