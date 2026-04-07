import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PlanType, TenantStatus, UserRole } from '@frota-leve/database';
import type { Prisma } from '@frota-leve/database';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/errors';
import { authCache } from './auth.cache';
import type {
  AuthResponse,
  AuthenticatedRequestUser,
  AuthTokenType,
  PublicTenant,
  PublicUser,
  TokenPayload,
} from './auth.types';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.validators';

type UserWithTenant = Prisma.UserGetPayload<{
  include: {
    tenant: true;
  };
}>;

type TransactionClient = Prisma.TransactionClient;

const PASSWORD_SALT_ROUNDS = 12;
const REFRESH_TOKEN_BLACKLIST_PREFIX = 'auth:refresh:blacklist';
const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const TRIAL_DAYS = 14;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, '');
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isJwtPayload(value: string | JwtPayload): value is JwtPayload {
  return typeof value !== 'string';
}

function isUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

function isTokenType(value: unknown): value is AuthTokenType {
  return value === 'access' || value === 'refresh';
}

function toPublicTenant(tenant: UserWithTenant['tenant']): PublicTenant {
  return {
    id: tenant.id,
    name: tenant.name,
    plan: tenant.plan,
    status: tenant.status,
    trialEndsAt: tenant.trialEndsAt,
  };
}

function toPublicUser(user: UserWithTenant): PublicUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  private buildResetPasswordEmail(params: {
    name: string;
    companyName: string;
    resetLink: string;
  }): string {
    const { name, companyName, resetLink } = params;

    return `
      <html lang="pt-BR">
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <h2>Redefinição de senha</h2>
          <p>Olá, ${name}.</p>
          <p>Recebemos uma solicitação para redefinir a senha da conta da empresa <strong>${companyName}</strong>.</p>
          <p>Use o link abaixo para criar uma nova senha. Ele expira em 1 hora.</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>Se você não solicitou essa alteração, ignore este e-mail.</p>
        </body>
      </html>
    `.trim();
  }

  private ensureTenantAllowed(status: TenantStatus): void {
    if (status === TenantStatus.SUSPENDED || status === TenantStatus.CANCELLED) {
      throw new ForbiddenError('Tenant suspenso ou cancelado');
    }
  }

  private signToken(user: UserWithTenant, type: AuthTokenType): string {
    const secret = type === 'access' ? env.JWT_SECRET : env.JWT_REFRESH_SECRET;
    const expiresIn = type === 'access' ? env.JWT_EXPIRES_IN : env.JWT_REFRESH_EXPIRES_IN;
    const jwtId = randomUUID();

    return jwt.sign(
      {
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        type,
      },
      secret,
      {
        subject: user.id,
        expiresIn: expiresIn as SignOptions['expiresIn'],
        jwtid: jwtId,
      },
    );
  }

  private verifyToken(token: string, expectedType: AuthTokenType): TokenPayload {
    try {
      const secret = expectedType === 'access' ? env.JWT_SECRET : env.JWT_REFRESH_SECRET;
      const decoded = jwt.verify(token, secret);

      if (!isJwtPayload(decoded)) {
        throw new UnauthorizedError('Token de autenticação inválido');
      }

      if (
        typeof decoded.sub !== 'string' ||
        typeof decoded.jti !== 'string' ||
        typeof decoded.email !== 'string' ||
        typeof decoded.tenantId !== 'string' ||
        !isUserRole(decoded.role) ||
        !isTokenType(decoded.type)
      ) {
        throw new UnauthorizedError('Token de autenticação inválido');
      }

      if (decoded.type !== expectedType) {
        throw new UnauthorizedError('Tipo de token inválido');
      }

      return {
        sub: decoded.sub,
        jti: decoded.jti,
        tenantId: decoded.tenantId,
        role: decoded.role,
        email: decoded.email,
        type: decoded.type,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      throw new UnauthorizedError('Token de autenticação inválido ou expirado', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async revokeRefreshToken(jwtId: string, exp?: number): Promise<void> {
    if (!exp) {
      return;
    }

    const ttlSeconds = Math.max(exp - Math.floor(Date.now() / 1000), 1);
    await authCache.set(`${REFRESH_TOKEN_BLACKLIST_PREFIX}:${jwtId}`, '1', ttlSeconds);
  }

  private async isRefreshTokenRevoked(jwtId: string): Promise<boolean> {
    const value = await authCache.get(`${REFRESH_TOKEN_BLACKLIST_PREFIX}:${jwtId}`);
    return value !== null;
  }

  private async issueTokens(user: UserWithTenant): Promise<AuthResponse> {
    const accessToken = this.signToken(user, 'access');
    const refreshToken = this.signToken(user, 'refresh');

    return {
      accessToken,
      refreshToken,
      user: toPublicUser(user),
      tenant: toPublicTenant(user.tenant),
    };
  }

  private async sendResetPasswordEmail(params: {
    email: string;
    name: string;
    companyName: string;
    resetToken: string;
  }): Promise<void> {
    const resetLink = `${env.FRONTEND_URL.replace(/\/$/, '')}/auth/reset-password?token=${params.resetToken}`;
    const html = this.buildResetPasswordEmail({
      name: params.name,
      companyName: params.companyName,
      resetLink,
    });

    if (!env.RESEND_API_KEY) {
      logger.info('E-mail de recuperação de senha gerado em modo fallback.', {
        email: params.email,
        resetLink,
        html,
      });
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
        to: [params.email],
        subject: 'Redefinição de senha - Frota Leve',
        html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao enviar e-mail de recuperação via Resend: ${response.status}`);
    }
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const cnpj = normalizeCnpj(input.cnpj);

    const [existingTenant, existingUser] = await Promise.all([
      prisma.tenant.findUnique({ where: { cnpj } }),
      prisma.user.findFirst({ where: { email } }),
    ]);

    if (existingTenant) {
      throw new ConflictError('CNPJ já cadastrado');
    }

    if (existingUser) {
      throw new ConflictError('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
    const trialEndsAt = addDays(new Date(), TRIAL_DAYS);

    const createdUser = await prisma.$transaction(async (tx: TransactionClient) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.companyName,
          cnpj,
          email,
          plan: PlanType.PROFESSIONAL,
          status: TenantStatus.TRIAL,
          trialEndsAt,
        },
      });

      return tx.user.create({
        data: {
          tenantId: tenant.id,
          name: input.name,
          email,
          passwordHash,
          role: UserRole.OWNER,
          isActive: true,
        },
        include: {
          tenant: true,
        },
      });
    });

    return this.issueTokens(createdUser);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const user = await prisma.user.findFirst({
      where: { email },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('E-mail ou senha inválidos');
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedError('E-mail ou senha inválidos');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Usuário inativo');
    }

    this.ensureTenantAllowed(user.tenant.status);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
      include: {
        tenant: true,
      },
    });

    return this.issueTokens(updatedUser);
  }

  async refresh(input: RefreshInput): Promise<AuthResponse> {
    const payload = this.verifyToken(input.refreshToken, 'refresh');

    if (await this.isRefreshTokenRevoked(payload.jti)) {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: true,
      },
    });

    if (
      !user ||
      user.email !== payload.email ||
      user.tenantId !== payload.tenantId ||
      user.role !== payload.role
    ) {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Usuário inativo');
    }

    this.ensureTenantAllowed(user.tenant.status);

    await this.revokeRefreshToken(payload.jti, payload.exp);

    return this.issueTokens(user);
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ success: true; message: string }> {
    const email = normalizeEmail(input.email);
    const user = await prisma.user.findFirst({
      where: { email },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      return {
        success: true,
        message: 'Se o e-mail existir, enviaremos as instruções de recuperação.',
      };
    }

    const resetToken = randomUUID();
    const tokenHash = hashOpaqueToken(resetToken);
    const now = new Date();

    await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: addSeconds(now, PASSWORD_RESET_TTL_SECONDS),
        },
      });
    });

    try {
      await this.sendResetPasswordEmail({
        email: user.email,
        name: user.name,
        companyName: user.tenant.name,
        resetToken,
      });
    } catch (error) {
      logger.error('Falha ao preparar e-mail de recuperação de senha.', {
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      success: true,
      message: 'Se o e-mail existir, enviaremos as instruções de recuperação.',
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ success: true; message: string }> {
    const tokenHash = hashOpaqueToken(input.token);
    const passwordResetToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (
      !passwordResetToken ||
      passwordResetToken.usedAt !== null ||
      passwordResetToken.expiresAt.getTime() <= Date.now()
    ) {
      throw new ValidationError('Token de redefinição inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);
    const now = new Date();

    await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.user.update({
        where: { id: passwordResetToken.userId },
        data: {
          passwordHash,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: passwordResetToken.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });
    });

    return {
      success: true,
      message: 'Senha redefinida com sucesso',
    };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<{ success: true; message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário autenticado não encontrado');
    }

    const currentPasswordMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);

    if (!currentPasswordMatches) {
      throw new UnauthorizedError('Senha atual inválida');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });

    return {
      success: true,
      message: 'Senha alterada com sucesso',
    };
  }

  async getMe(userId: string): Promise<{ user: PublicUser; tenant: PublicTenant }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário autenticado não encontrado');
    }

    this.ensureTenantAllowed(user.tenant.status);

    return {
      user: toPublicUser(user),
      tenant: toPublicTenant(user.tenant),
    };
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedRequestUser> {
    const payload = this.verifyToken(token, 'access');
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tenantId: true,
        role: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Token de autenticação inválido');
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
  }
}

export const authService = new AuthService();
