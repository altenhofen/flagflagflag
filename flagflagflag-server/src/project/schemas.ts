import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema;
