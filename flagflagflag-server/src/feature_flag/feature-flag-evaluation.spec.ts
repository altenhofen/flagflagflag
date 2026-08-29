import { describe, expect, it } from 'vitest';
import { FeatureFlagEvaluation } from './feature-flag-evaluation.js';

describe('FeatureFlagEvaluation', () => {
  it('requires an enabled flag before evaluating rules or rollout', () => {
    const evaluation = new FeatureFlagEvaluation(() => 0);

    expect(
      evaluation.evaluate(
        {
          enabled: false,
          percentage: 100,
          rules: [],
        },
        {},
      ),
    ).toBe(false);
  });

  it('requires every targeting rule to match', () => {
    const evaluation = new FeatureFlagEvaluation(() => 0);

    expect(
      evaluation.evaluate(
        {
          enabled: true,
          percentage: 100,
          rules: [
            { attribute: 'plan', operator: 'equals', value: 'pro' },
            { attribute: 'region', operator: 'in', value: ['eu', 'us'] },
          ],
        },
        { plan: 'pro', region: 'apac' },
      ),
    ).toBe(false);
  });

  it('supports compatible operator comparisons', () => {
    const evaluation = new FeatureFlagEvaluation(() => 0);

    expect(
      evaluation.evaluate(
        {
          enabled: true,
          percentage: 100,
          rules: [
            { attribute: 'name', operator: 'contains', value: 'flag' },
            { attribute: 'age', operator: 'greaterThanOrEqual', value: 18 },
            { attribute: 'plan', operator: 'notEquals', value: 'free' },
          ],
        },
        { name: 'feature-flag', age: 21, plan: 'pro' },
      ),
    ).toBe(true);
  });

  it('rejects missing and mismatched attributes', () => {
    const evaluation = new FeatureFlagEvaluation(() => 0);

    expect(
      evaluation.evaluate(
        {
          enabled: true,
          percentage: 100,
          rules: [{ attribute: 'age', operator: 'greaterThan', value: 18 }],
        },
        { age: '21' },
      ),
    ).toBe(false);

    expect(
      evaluation.evaluate(
        {
          enabled: true,
          percentage: 100,
          rules: [{ attribute: 'age', operator: 'notEquals', value: 18 }],
        },
        { age: '21' },
      ),
    ).toBe(false);
  });

  it('applies percentage rollout after matching rules', () => {
    expect(
      new FeatureFlagEvaluation(() => 0.5).evaluate(
        { enabled: true, percentage: 50, rules: [] },
        {},
      ),
    ).toBe(false);
    expect(
      new FeatureFlagEvaluation(() => 0.49).evaluate(
        { enabled: true, percentage: 50, rules: [] },
        {},
      ),
    ).toBe(true);
  });

  it('treats empty rules as a match and preserves rollout edges', () => {
    const random = () => {
      throw new Error('randomness should not be needed');
    };
    const evaluation = new FeatureFlagEvaluation(random);

    expect(
      evaluation.evaluate({ enabled: true, percentage: 0, rules: [] }, {}),
    ).toBe(false);
    expect(
      evaluation.evaluate({ enabled: true, percentage: 100, rules: [] }, {}),
    ).toBe(true);
  });
});
