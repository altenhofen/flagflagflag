import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(200);
const ContextValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
]);

export const EvaluationContextSchema = z
  .record(z.string().trim().min(1).max(100), ContextValueSchema)
  .refine((context) => Object.keys(context).length <= 50, {
    message: 'context cannot contain more than 50 attributes',
  });

export const EvaluateRequestSchema = z
  .object({
    projectId: IdentifierSchema,
    environmentId: IdentifierSchema,
    flagKey: IdentifierSchema,
    context: EvaluationContextSchema.default({}),
    fallback: z.boolean().default(false),
  })
  .strict();

export const BatchEvaluateRequestSchema = z
  .object({
    projectId: IdentifierSchema,
    environmentId: IdentifierSchema,
    context: EvaluationContextSchema.default({}),
    flags: z
      .array(IdentifierSchema)
      .min(1)
      .max(100)
      .refine((flags) => new Set(flags).size === flags.length, {
        message: 'flags must not contain duplicates',
      }),
    fallback: z.boolean().default(false),
  })
  .strict();

export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;
export type BatchEvaluateRequest = z.infer<typeof BatchEvaluateRequestSchema>;
