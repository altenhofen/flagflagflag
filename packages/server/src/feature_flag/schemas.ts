import { z } from 'zod';

export const FeatureFlagKeySchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]{0,99}$/);

const RuleAttributeSchema = z.string().trim().min(1).max(100);
const RuleStringValueSchema = z.string().max(500);
const RuleScalarValueSchema = z.union([
  RuleStringValueSchema,
  z.number().finite(),
  z.boolean(),
]);
export const RuleOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'in',
  'notIn',
  'contains',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
]);

export const TargetingConditionSchema = z
  .object({
    attribute: RuleAttributeSchema,
    operator: RuleOperatorSchema,
    value: z.union([
      RuleScalarValueSchema,
      z.array(RuleStringValueSchema).min(1).max(100),
    ]),
  })
  .strict()
  .superRefine((condition, context) => {
    const isArray = Array.isArray(condition.value);
    const isString = typeof condition.value === 'string';
    const isNumber = typeof condition.value === 'number';
    if (['in', 'notIn'].includes(condition.operator) && !isArray) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `${condition.operator} requires a string array value`,
      });
    }
    if (condition.operator === 'contains' && !isString) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'contains requires a string value',
      });
    }
    if (
      ['greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'].includes(
        condition.operator,
      ) &&
      !isNumber
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'numeric operators require a number value',
      });
    }
    if (['equals', 'notEquals'].includes(condition.operator) && isArray) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'equality operators require a scalar value',
      });
    }
  });
export type TargetingCondition = z.infer<typeof TargetingConditionSchema>;

export const TargetingRuleSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    priority: z.number().int().min(0),
    result: z.boolean(),
    conditions: z.array(TargetingConditionSchema).min(1).max(20),
  })
  .strict();
export const TargetingRulesSchema = z.array(TargetingRuleSchema).max(20);
export type TargetingRule = z.infer<typeof TargetingRuleSchema>;

export const EvaluationAttributesSchema = z.record(
  z.string(),
  z.union([z.string().max(500), z.number().finite(), z.boolean()]),
);
export type EvaluationAttributes = z.infer<typeof EvaluationAttributesSchema>;

export const RolloutSchema = z
  .object({
    percentage: z.number().int().min(0).max(100),
    attribute: z.string().trim().min(1).max(100),
  })
  .strict();
export type Rollout = z.infer<typeof RolloutSchema>;

export const CreateFeatureFlagSchema = z
  .object({
    key: FeatureFlagKeySchema,
    name: z.string().trim().min(1).max(200),
    enabled: z.boolean(),
    defaultValue: z.boolean(),
    rollout: RolloutSchema.nullable(),
    rules: TargetingRulesSchema,
  })
  .strict();
export type CreateFeatureFlag = z.infer<typeof CreateFeatureFlagSchema>;

export const UpdateFeatureFlagSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    enabled: z.boolean().optional(),
    defaultValue: z.boolean().optional(),
    rollout: RolloutSchema.nullable().optional(),
    rules: TargetingRulesSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one mutable property is required',
  });
