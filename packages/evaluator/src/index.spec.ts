import { describe, expect, it } from 'vitest';
import { evaluateFlag, type FlagConfig, type TargetingOperator } from './index.js';

const base: FlagConfig = {
  key: 'checkout',
  enabled: true,
  defaultValue: false,
  rollout: null,
  rules: [],
};
const rule = (operator: TargetingOperator, value: string | number | boolean | string[], result = true) => ({
  id: 'r1',
  priority: 1,
  result,
  conditions: [{ attribute: 'plan', operator, value }],
});

describe('evaluateFlag', () => {
  it('handles disabled and default flags', () => {
    expect(evaluateFlag({ ...base, enabled: false, defaultValue: true }, {}).reason).toBe('FLAG_DISABLED');
    expect(evaluateFlag({ ...base, defaultValue: true }, {}).value).toBe(true);
  });

  it('uses ascending first-match rules with AND conditions', () => {
    const flag = { ...base, rules: [
      { id: 'late', priority: 2, result: true, conditions: [{ attribute: 'country', operator: 'equals' as const, value: 'BR' }] },
      { id: 'early', priority: 1, result: false, conditions: [
        { attribute: 'country', operator: 'equals' as const, value: 'BR' },
        { attribute: 'plan', operator: 'equals' as const, value: 'pro' },
      ] },
    ] };
    expect(evaluateFlag(flag, { country: 'BR', plan: 'pro' })).toEqual({ value: false, reason: 'RULE_MATCH', matchedRuleId: 'early' });
    expect(evaluateFlag(flag, { country: 'BR', plan: 'free' }).matchedRuleId).toBe('late');
  });

  it('supports the complete operator vocabulary without coercion', () => {
    expect(evaluateFlag({ ...base, rules: [rule('equals', 'pro')] }, { plan: 'pro' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('notEquals', 'pro')] }, { plan: 'free' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('in', ['pro', 'team'])] }, { plan: 'team' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('notIn', ['free'])] }, { plan: 'team' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('contains', 'pr')] }, { plan: 'pro' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('greaterThanOrEqual', 10)] }, { plan: 10 }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('lessThanOrEqual', 10)] }, { plan: 10 }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('equals', 10)] }, { plan: '10' }).reason).toBe('DEFAULT');
  });

  it('uses environment, flag, and configured context attribute for deterministic rollout', () => {
    const flag = { ...base, rollout: { percentage: 100, attribute: 'accountId' } };
    const first = evaluateFlag(flag, { accountId: '123' }, 'production');
    expect(evaluateFlag(flag, { accountId: '123' }, 'production')).toEqual(first);
    expect(evaluateFlag({ ...base, rollout: { percentage: 0, attribute: 'accountId' } }, { accountId: '123' }, 'production').reason).toBe('ROLLOUT_MISS');
    expect(evaluateFlag(flag, {}, 'production')).toEqual({ value: false, reason: 'ROLLOUT_MISS' });
  });
});
