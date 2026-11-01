import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 symbols'),
  email: z.email('Please provide email format'),
  password: z
    .string()
    .min(6, 'Password must have at least 6 symbols')
    .regex(/[A-Z]/, 'Password must have at least one uppercase letter')
    .regex(/[a-z]/, 'Password must have at least one lowercase letter')
    .regex(/[0-9]/, 'Password must have at least one digit')
    .regex(
      /[^A-Za-z0-9\s]/,
      'Password must have at least one special symbol (!@#$_)',
    ),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const registerSchemaResponse = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(3),
});

export type RegisterResponseDto = z.infer<typeof registerSchemaResponse>;
