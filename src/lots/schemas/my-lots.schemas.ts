import { z } from 'zod';

export const myLotsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type MyLotsQueryDto = z.infer<typeof myLotsQuerySchema>;
