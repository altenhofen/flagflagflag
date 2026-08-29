import { describe, expect, it } from 'vitest';
import { evaluateFlag, type FlagConfig, type TargetingOperator } from './index.js';

const base: FlagConfig = { key: 'checkout', enabled: true, defaultValue: false, rules: [] };
const rule = (operator: TargetingOperator, value: unknown, result = true) => ({ id: 'r1', priority: 1, result, conditions: [{ attribute: 'plan', operator, value }] });

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
  it('supports all operators without coercion or missing attributes', () => {
    expect(evaluateFlag({ ...base, rules: [rule('equals', 'pro')] }, { plan: 'pro' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('not_equals', 'pro')] }, { plan: 'free' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('in', ['pro', 'team'])] }, { plan: 'team' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('not_in', ['free'])] }, { plan: 'team' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('contains', 'pr')] }, { plan: 'pro' }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('greater_than', 10)] }, { plan: 11 }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('less_than', 10)] }, { plan: 9 }).value).toBe(true);
    expect(evaluateFlag({ ...base, rules: [rule('equals', 10)] }, { plan: '10' }).reason).toBe('DEFAULT');
    expect(evaluateFlag({ ...base, rules: [rule('equals', 'x')] }, {}).reason).toBe('DEFAULT');
  });
  it('hashes flag and user deterministically and respects boundaries', () => {
    const flag = { ...base, rolloutPercentage: 20 };
    const first = evaluateFlag(flag, { userId: '123' });
    expect(evaluateFlag(flag, { userId: '123' })).toEqual(first);
    expect(evaluateFlag({ ...base, rolloutPercentage: 0 }, { userId: '123' }).reason).toBe('ROLLOUT_MISS');
    expect(evaluateFlag({ ...base, rolloutPercentage: 100 }, { userId: '123' }).reason).toBe('ROLLOUT_MATCH');
  });
});
