export type EvaluationContext = Record<string, unknown>;

export type TargetingOperator =
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual';

export interface ConditionConfig {
  attribute: string;
  operator: TargetingOperator;
  value: string | number | boolean | string[];
}

export interface TargetingRuleConfig {
  id: string;
  priority: number;
  result: boolean;
  conditions: ConditionConfig[];
}

export interface RolloutConfig {
  percentage: number;
  attribute: string;
}

export interface FlagConfig {
  key: string;
  name?: string;
  enabled: boolean;
  defaultValue: boolean;
  rollout: RolloutConfig | null;
  rules: TargetingRuleConfig[];
}

export interface SdkEnvironment {
  id: string;
  key: string;
}

export interface SdkConfig {
  schemaVersion: 1;
  configVersion: number;
  environment: SdkEnvironment;
  flags: Record<string, FlagConfig>;
}

export type EvaluationReason =
  | 'FLAG_DISABLED'
  | 'RULE_MATCH'
  | 'ROLLOUT_MATCH'
  | 'ROLLOUT_MISS'
  | 'DEFAULT'
  | 'FLAG_NOT_FOUND'
  | 'NO_CONFIG';

export interface EvaluationResult {
  value: boolean;
  reason: EvaluationReason;
  matchedRuleId?: string;
}

export function evaluateFlag(
  flag: FlagConfig,
  context: EvaluationContext,
  environmentId = '',
): EvaluationResult {
  if (!flag.enabled) return { value: false, reason: 'FLAG_DISABLED' };

  const rules = [...flag.rules].sort((left, right) => left.priority - right.priority);
  for (const rule of rules) {
    if (rule.conditions.every((condition) => matchesCondition(condition, context))) {
      return { value: rule.result, reason: 'RULE_MATCH', matchedRuleId: rule.id };
    }
  }

  if (flag.rollout !== null) {
    const identifier = context[flag.rollout.attribute];
    if (typeof identifier !== 'string' && typeof identifier !== 'number') {
      return { value: false, reason: 'ROLLOUT_MISS' };
    }
    const bucket = hash(`${environmentId}:${flag.key}:${String(identifier)}`) % 100;
    return bucket < flag.rollout.percentage
      ? { value: true, reason: 'ROLLOUT_MATCH' }
      : { value: false, reason: 'ROLLOUT_MISS' };
  }

  return { value: flag.defaultValue, reason: 'DEFAULT' };
}

function matchesCondition(condition: ConditionConfig, context: EvaluationContext): boolean {
  if (!Object.prototype.hasOwnProperty.call(context, condition.attribute)) return false;
  const actual = context[condition.attribute];
  const expected = condition.value;
  switch (condition.operator) {
    case 'equals':
      return sameType(actual, expected) && actual === expected;
    case 'notEquals':
      return sameType(actual, expected) && actual !== expected;
    case 'in':
      return Array.isArray(expected) && typeof actual === 'string' && expected.includes(actual);
    case 'notIn':
      return Array.isArray(expected) && typeof actual === 'string' && !expected.includes(actual);
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    case 'greaterThan':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'greaterThanOrEqual':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lessThan':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lessThanOrEqual':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
  }
}

function sameType(left: unknown, right: unknown): boolean {
  return typeof left === typeof right && left !== null && right !== null;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
