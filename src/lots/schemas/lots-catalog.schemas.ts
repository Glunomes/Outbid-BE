import { z } from 'zod';
import { AuctionStatus } from '../../generated/prisma/enums.js';

export const lotsCatalogQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    name: z.string().trim().min(1).optional(),
    status: z.enum(AuctionStatus).optional(),
    auctionStartFrom: z.iso.datetime({ offset: true }).optional(),
    auctionStartTo: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine(({ auctionStartFrom, auctionStartTo }, ctx) => {
    if (
      auctionStartFrom &&
      auctionStartTo &&
      new Date(auctionStartFrom) > new Date(auctionStartTo)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['auctionStartTo'],
        message: 'End of start-time range must not be before its beginning.',
      });
    }
  });

export type LotsCatalogQueryDto = z.infer<typeof lotsCatalogQuerySchema>;
