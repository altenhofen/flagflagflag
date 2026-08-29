import { z } from 'zod';

export const EnvironmentNameSchema = z.string().trim().min(1);

const RuleAttributeSchema = z.string().trim().min(1).max(100);
const RuleStringValueSchema = z.string().min(1).max(500);
const RuleScalarValueSchema = z.union([
  RuleStringValueSchema,
  z.number().finite(),
  z.boolean(),
]);
const RuleOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'in',
  'contains',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
]);

export const TargetingRuleSchema = z
  .object({
    attribute: RuleAttributeSchema,
    operator: RuleOperatorSchema,
    value: z.union([
      RuleScalarValueSchema,
      z.array(RuleStringValueSchema).min(1).max(100),
    ]),
  })
  .strict()
  .superRefine((rule, context) => {
    const stringValue = typeof rule.value === 'string';
    const arrayValue = Array.isArray(rule.value);
    const numericValue = typeof rule.value === 'number';
    const operator = rule.operator;

    if (operator === 'in' && !arrayValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'in requires a string array value',
        path: ['value'],
      });
    }
    if (operator === 'contains' && !stringValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'contains requires a string value',
        path: ['value'],
      });
    }
    if (
      [
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
      ].includes(operator) &&
      !numericValue
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'numeric operators require a number value',
        path: ['value'],
      });
    }
    if (['equals', 'notEquals'].includes(operator) && arrayValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'equality operators require a scalar value',
        path: ['value'],
      });
    }
  });

export const TargetingRulesSchema = z.array(TargetingRuleSchema).max(20);

export type TargetingRule = z.infer<typeof TargetingRuleSchema>;

export const EvaluationAttributesSchema = z.record(
  z.string(),
  z.union([z.string().max(500), z.number().finite(), z.boolean()]),
);

export type EvaluationAttributes = z.infer<typeof EvaluationAttributesSchema>;

export const CreateFeatureFlagSchema = z.object({
  name: z.string().trim().min(1),
  enabled: z.boolean(),
  percentage: z.number().int().min(0).max(100).default(100),
  rules: TargetingRulesSchema.default([]),
  projectId: z.string().trim().min(1),
  environment: EnvironmentNameSchema,
});

export const GetFeatureFlagSchema = z.object({
  projectId: z.string().trim().min(1),
  environment: EnvironmentNameSchema,
});

export type CreateFeatureFlag = z.infer<typeof CreateFeatureFlagSchema>;

export const UpdateFeatureFlagSchema = z.object({
  enabled: z.boolean(),
  percentage: z.number().int().min(0).max(100).optional(),
  rules: TargetingRulesSchema.optional(),
});

export const EvaluateFeatureFlagSchema = z.object({
  projectId: z.string().trim().min(1),
  environment: EnvironmentNameSchema,
  attributes: EvaluationAttributesSchema.default({}),
});
