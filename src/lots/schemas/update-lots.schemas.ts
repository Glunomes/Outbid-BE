import { z } from 'zod';
import { getAuctionScheduleIssues } from '../utils/auction-schedule.util.js';
import { lotSchemaResponse, lotPriceSchema } from './create-lots.schemas.js';

const auctionDateSchema = z.iso.datetime({ offset: true });

export const updateLotSchema = z
  .object({
    name: z.string().min(3),
    description: z.string().nullable(),
    startingPrice: lotPriceSchema,
    auctionStart: auctionDateSchema.nullable(),
    auctionEnd: auctionDateSchema.nullable(),
  })
  .strict()
  .superRefine((dto, ctx) => {
    for (const issue of getAuctionScheduleIssues(
      dto.auctionStart,
      dto.auctionEnd,
      'update',
    )) {
      ctx.addIssue({
        code: 'custom',
        path: [issue.path],
        message: issue.message,
      });
    }
  });

export type UpdateLotDto = z.infer<typeof updateLotSchema>;

export const updateLotSchemaResponse = lotSchemaResponse;

export type UpdateLotResponseDto = z.infer<typeof updateLotSchemaResponse>;
