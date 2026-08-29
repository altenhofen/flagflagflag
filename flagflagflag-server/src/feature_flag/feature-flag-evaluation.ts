import type { EvaluationAttributes, TargetingRule } from './schemas.js';

export interface FeatureFlagEvaluationInput {
  enabled: boolean;
  percentage: number;
  rules: TargetingRule[];
}

type RandomSource = () => number;

export class FeatureFlagEvaluation {
  constructor(private readonly random: RandomSource = Math.random) {}

  evaluate(
    flag: FeatureFlagEvaluationInput,
    attributes: EvaluationAttributes,
  ): boolean {
    if (
      !flag.enabled ||
      !flag.rules.every((rule) => matchesRule(rule, attributes))
    ) {
      return false;
    }
    if (flag.percentage <= 0) {
      return false;
    }
    if (flag.percentage >= 100) {
      return true;
    }
    return this.random() * 100 < flag.percentage;
  }
}

function matchesRule(
  rule: TargetingRule,
  attributes: EvaluationAttributes,
): boolean {
  if (!(rule.attribute in attributes)) {
    return false;
  }

  const attribute = attributes[rule.attribute];
  switch (rule.operator) {
    case 'equals':
      return !Array.isArray(rule.value) && attribute === rule.value;
    case 'notEquals':
      return (
        !Array.isArray(rule.value) &&
        typeof attribute === typeof rule.value &&
        attribute !== rule.value
      );
    case 'in':
      return (
        typeof attribute === 'string' &&
        Array.isArray(rule.value) &&
        rule.value.includes(attribute)
      );
    case 'contains':
      return (
        typeof attribute === 'string' &&
        typeof rule.value === 'string' &&
        attribute.includes(rule.value)
      );
    case 'greaterThan':
      return (
        typeof attribute === 'number' &&
        typeof rule.value === 'number' &&
        attribute > rule.value
      );
    case 'greaterThanOrEqual':
      return (
        typeof attribute === 'number' &&
        typeof rule.value === 'number' &&
        attribute >= rule.value
      );
    case 'lessThan':
      return (
        typeof attribute === 'number' &&
        typeof rule.value === 'number' &&
        attribute < rule.value
      );
    case 'lessThanOrEqual':
      return (
        typeof attribute === 'number' &&
        typeof rule.value === 'number' &&
        attribute <= rule.value
      );
  }
}
