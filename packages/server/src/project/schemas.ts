import { z } from 'zod';

export const CreateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
  })
  .strict();

export type CreateProject = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one mutable property is required',
  });
