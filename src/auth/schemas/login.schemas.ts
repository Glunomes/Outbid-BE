import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Please provide email format'),
  password: z.string(),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const loginSchemaResponse = z.object({
  accessToken: z.jwt(),
  refreshToken: z.jwt(),
});

export type LoginResponseDto = z.infer<typeof loginSchemaResponse>;
