import { z } from 'zod';
import { AuctionStatus } from '../../generated/prisma/enums.js';
import { getAuctionScheduleIssues } from '../utils/auction-schedule.util.js';

const auctionDateSchema = z.iso.datetime({ offset: true });

export const lotPriceSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    'Enter a valid price with up to 2 decimal places',
  )
  .refine((value) => Number(value) >= 0, 'Price cannot be negative');

export const createLotSchema = z
  .object({
    name: z.string().min(3),
    description: z.string().optional(),
    startingPrice: lotPriceSchema,
    auctionStart: auctionDateSchema.optional(),
    auctionEnd: auctionDateSchema.optional(),
  })
  .superRefine(({ auctionStart, auctionEnd }, ctx) => {
    for (const issue of getAuctionScheduleIssues(
      auctionStart,
      auctionEnd,
      'create',
    )) {
      ctx.addIssue({
        code: 'custom',
        path: [issue.path],
        message: issue.message,
      });
    }
  });

export type CreateLotDto = z.infer<typeof createLotSchema>;

export const lotSchemaResponse = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  startingPrice: z.string(),
  currentPrice: z.string().nullable(),
  auctionStart: z.iso.datetime().nullable(),
  auctionEnd: z.iso.datetime().nullable(),
  status: z.enum(AuctionStatus),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type LotResponseDto = z.infer<typeof lotSchemaResponse>;
