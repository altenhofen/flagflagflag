import { z } from 'zod';

export const DefaultUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(5),
});

export type DefaultUser = z.infer<typeof DefaultUserSchema>;
