import { describe, expect, it } from 'vitest';
import { FeatureFlagEvaluation } from './feature-flag-evaluation.js';

const baseFlag = {
  key: 'new-checkout',
  environmentId: 'staging-id',
  enabled: true,
  defaultValue: false,
  rollout: null,
  rules: [],
};

describe('FeatureFlagEvaluation', () => {
  it('returns false for a disabled flag before rules or rollout', () => {
    const evaluation = new FeatureFlagEvaluation();

    expect(
      evaluation.evaluate(
        {
          ...baseFlag,
          enabled: false,
          defaultValue: true,
          rollout: { percentage: 100, attribute: 'userId' },
          rules: [
            {
              id: 'enable-pro-users',
              priority: 1,
              result: true,
              conditions: [
                { attribute: 'plan', operator: 'equals', value: 'pro' },
              ],
            },
          ],
        },
        { plan: 'pro', userId: 'user-1' },
      ),
    ).toBe(false);
  });

  it('uses AND semantics within a rule and returns its explicit result', () => {
    const evaluation = new FeatureFlagEvaluation();
    const flag = {
      ...baseFlag,
      rules: [
        {
          id: 'pro-us',
          priority: 10,
          result: true,
          conditions: [
            { attribute: 'plan', operator: 'equals' as const, value: 'pro' },
            { attribute: 'country', operator: 'in' as const, value: ['US', 'CA'] },
          ],
        },
      ],
    };

    expect(evaluation.evaluate(flag, { plan: 'pro', country: 'US' })).toBe(true);
    expect(evaluation.evaluate(flag, { plan: 'pro', country: 'DE' })).toBe(false);
  });

  it('sorts rules by priority and uses the first matching rule', () => {
    const evaluation = new FeatureFlagEvaluation();
    const flag = {
      ...baseFlag,
      defaultValue: true,
      rules: [
        {
          id: 'fallback-deny',
          priority: 20,
          result: false,
          conditions: [
            { attribute: 'plan', operator: 'equals' as const, value: 'pro' },
          ],
        },
        {
          id: 'priority-allow',
          priority: 10,
          result: true,
          conditions: [
            { attribute: 'plan', operator: 'equals' as const, value: 'pro' },
          ],
        },
      ],
    };

    expect(evaluation.evaluate(flag, { plan: 'pro' })).toBe(true);
    expect(evaluation.evaluate(flag, { plan: 'free' })).toBe(true);
  });

  it('supports the shared operator comparisons and rejects mismatched attributes', () => {
    const evaluation = new FeatureFlagEvaluation();
    const flag = {
      ...baseFlag,
      rules: [
        {
          id: 'compatible-operators',
          priority: 1,
          result: true,
          conditions: [
            { attribute: 'name', operator: 'contains' as const, value: 'flag' },
            { attribute: 'age', operator: 'greaterThanOrEqual' as const, value: 18 },
            { attribute: 'plan', operator: 'notEquals' as const, value: 'free' },
          ],
        },
      ],
    };

    expect(
      evaluation.evaluate(flag, { name: 'feature-flag', age: 21, plan: 'pro' }),
    ).toBe(true);
    expect(evaluation.evaluate(flag, { name: 'feature-flag', age: '21' })).toBe(false);
  });

  it('uses deterministic rollout after rules and defaultValue without rollout', () => {
    const evaluation = new FeatureFlagEvaluation();

    expect(
      evaluation.evaluate(
        { ...baseFlag, rollout: { percentage: 0, attribute: 'userId' } },
        { userId: 'user-1' },
      ),
    ).toBe(false);
    expect(
      evaluation.evaluate(
        { ...baseFlag, rollout: { percentage: 100, attribute: 'userId' } },
        { userId: 'user-1' },
      ),
    ).toBe(true);
    expect(
      evaluation.evaluate({ ...baseFlag, defaultValue: true }, { userId: 'user-1' }),
    ).toBe(true);
  });
});
