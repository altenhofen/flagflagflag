import { z } from 'zod';

export const SignUpSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(5),
});

export const SignInSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(5),
});

export const DefaultUserSchema = SignUpSchema;

export type DefaultUser = z.infer<typeof DefaultUserSchema>;
