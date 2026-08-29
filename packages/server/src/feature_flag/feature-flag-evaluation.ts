import { evaluateFlag } from '@flagflagflag/evaluator';
import type { EvaluationAttributes, Rollout, TargetingRule } from './schemas.js';

export interface FeatureFlagEvaluationInput {
  key: string;
  environmentId: string;
  enabled: boolean;
  defaultValue: boolean;
  rollout: Rollout | null;
  rules: TargetingRule[];
}

export class FeatureFlagEvaluation {
  constructor(_legacyRandom?: () => number) {}

  evaluate(flag: FeatureFlagEvaluationInput, attributes: EvaluationAttributes): boolean {
    return evaluateFlag(flag, attributes, flag.environmentId).value;
  }
}
