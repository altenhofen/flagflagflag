export type EvaluationContext = Record<string, unknown>;

export type TargetingOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'greater_than'
  | 'less_than';

export interface ConditionConfig {
  attribute: string;
  operator: TargetingOperator;
  value: unknown;
}

export interface TargetingRuleConfig {
  id: string;
  priority: number;
  result: boolean;
  conditions: ConditionConfig[];
}

export interface FlagConfig {
  key: string;
  enabled: boolean;
  defaultValue: boolean;
  rolloutPercentage?: number;
  rules: TargetingRuleConfig[];
}

export interface SdkConfig {
  version: number;
  environment: string;
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
): EvaluationResult {
  if (flag.enabled === false) {
    return { value: false, reason: 'FLAG_DISABLED' };
  }

  const rules = [...flag.rules].sort((a, b) => a.priority - b.priority);
  for (const rule of rules) {
    if (rule.conditions.every((condition) => matchesCondition(condition, context))) {
      return { value: rule.result, reason: 'RULE_MATCH', matchedRuleId: rule.id };
    }
  }

  if (flag.rolloutPercentage !== undefined) {
    const identifier = context.userId;
    if (typeof identifier !== 'string' && typeof identifier !== 'number') {
      return { value: false, reason: 'ROLLOUT_MISS' };
    }
    const bucket = hash(`${flag.key}:${String(identifier)}`) % 100;
    return bucket < flag.rolloutPercentage
      ? { value: true, reason: 'ROLLOUT_MATCH' }
      : { value: false, reason: 'ROLLOUT_MISS' };
  }

  return { value: flag.defaultValue, reason: 'DEFAULT' };
}

function matchesCondition(
  condition: ConditionConfig,
  context: EvaluationContext,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(context, condition.attribute)) {
    return false;
  }
  const actual = context[condition.attribute];
  const expected = condition.value;
  switch (condition.operator) {
    case 'equals':
      return sameType(actual, expected) && actual === expected;
    case 'not_equals':
      return sameType(actual, expected) && actual !== expected;
    case 'in':
      return Array.isArray(expected) && expected.some((item) => sameType(actual, item) && actual === item);
    case 'not_in':
      return Array.isArray(expected) && expected.every((item) => !sameType(actual, item) || actual !== item);
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    case 'greater_than':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'less_than':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
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
