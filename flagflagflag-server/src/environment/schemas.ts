import { z } from 'zod';

export const CreateEnvironmentSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateEnvironment = z.infer<typeof CreateEnvironmentSchema>;
