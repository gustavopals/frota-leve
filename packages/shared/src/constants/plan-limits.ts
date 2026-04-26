import { PlanType } from '../enums/plan.enum';

export const AI_MODEL_HAIKU = 'claude-haiku-4-5-20251001';
export const AI_MODEL_SONNET = 'claude-sonnet-4-6';
export const AI_MODEL_OPUS = 'claude-opus-4-7';

export const AI_MONTHLY_TOKEN_BUDGET_PRO = 2_000_000;
export const AI_MONTHLY_TOKEN_BUDGET_ENT = 20_000_000;

export interface PlanLimits {
  maxVehicles: number;
  maxUsers: number;
  hasAI: boolean;
  hasAPI: boolean;
  hasTires: boolean;
  aiMonthlyTokenBudget: number;
  aiModelsAllowed: string[];
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  [PlanType.ESSENTIAL]: {
    maxVehicles: 10,
    maxUsers: 3,
    hasAI: false,
    hasAPI: false,
    hasTires: false,
    aiMonthlyTokenBudget: 0,
    aiModelsAllowed: [],
  },
  [PlanType.PROFESSIONAL]: {
    maxVehicles: 100,
    maxUsers: 20,
    hasAI: true,
    hasAPI: true,
    hasTires: true,
    aiMonthlyTokenBudget: AI_MONTHLY_TOKEN_BUDGET_PRO,
    aiModelsAllowed: [AI_MODEL_HAIKU, AI_MODEL_SONNET],
  },
  [PlanType.ENTERPRISE]: {
    maxVehicles: Infinity,
    maxUsers: Infinity,
    hasAI: true,
    hasAPI: true,
    hasTires: true,
    aiMonthlyTokenBudget: AI_MONTHLY_TOKEN_BUDGET_ENT,
    aiModelsAllowed: [AI_MODEL_HAIKU, AI_MODEL_SONNET, AI_MODEL_OPUS],
  },
};
