import type { PlanType, TenantStatus, UserRole } from '@frota-leve/database';

export type AuthTokenType = 'access' | 'refresh';

export type TokenPayload = {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  type: AuthTokenType;
  jti: string;
  iat?: number;
  exp?: number;
};

export type AuthenticatedRequestUser = {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
};

export type PublicTenant = {
  id: string;
  name: string;
  plan: PlanType;
  status: TenantStatus;
  trialEndsAt: Date | null;
};

export type PublicUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  tenant: PublicTenant;
};
