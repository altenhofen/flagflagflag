import { z } from 'zod';

export const CreateEnvironmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export const UpdateEnvironmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one mutable property is required',
  });

export type CreateEnvironment = z.infer<typeof CreateEnvironmentSchema>;
