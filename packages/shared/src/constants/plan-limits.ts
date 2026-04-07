import { PlanType } from '../enums/plan.enum';

export interface PlanLimits {
  maxVehicles: number;
  maxUsers: number;
  hasAI: boolean;
  hasAPI: boolean;
  hasTires: boolean;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  [PlanType.ESSENTIAL]: {
    maxVehicles: 10,
    maxUsers: 3,
    hasAI: false,
    hasAPI: false,
    hasTires: false,
  },
  [PlanType.PROFESSIONAL]: {
    maxVehicles: 100,
    maxUsers: 20,
    hasAI: true,
    hasAPI: true,
    hasTires: true,
  },
  [PlanType.ENTERPRISE]: {
    maxVehicles: Infinity,
    maxUsers: Infinity,
    hasAI: true,
    hasAPI: true,
    hasTires: true,
  },
};
