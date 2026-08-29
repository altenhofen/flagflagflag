import { z } from 'zod';

export const EnvironmentNameSchema = z.string().trim().min(1);

export const CreateFeatureFlagSchema = z.object({
  name: z.string().trim().min(1),
  enabled: z.boolean(),
  percentage: z.number().int().min(0).max(100).default(100),
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
});
