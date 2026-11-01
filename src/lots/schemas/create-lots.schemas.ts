import { z } from 'zod';
import { AuctionStatus } from '../../generated/prisma/enums.js';

const auctionDateSchema = z.iso.datetime({ offset: true });

export const createLotSchema = z
  .object({
    name: z.string().min(3),
    description: z.string().optional(),
    startingPrice: z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
        'Enter a valid price with up to 2 decimal places',
      )
      .refine((value) => Number(value) >= 0, 'Price cannot be negative'),
    auctionStart: auctionDateSchema.optional(),
    auctionEnd: auctionDateSchema.optional(),
  })
  .superRefine(({ auctionStart, auctionEnd }, ctx) => {
    if (auctionStart && !auctionEnd) {
      ctx.addIssue({
        code: 'custom',
        path: ['auctionEnd'],
        message: 'Auction end time is required when start time is set.',
      });
    }

    if (auctionEnd && !auctionStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['auctionStart'],
        message: 'Auction start time is required when end time is set.',
      });
    }

    if (auctionStart && new Date(auctionStart).getTime() < Date.now()) {
      ctx.addIssue({
        code: 'custom',
        path: ['auctionStart'],
        message: 'Auction start time cannot be in the past.',
      });
    }

    if (
      auctionStart &&
      auctionEnd &&
      new Date(auctionEnd).getTime() <= new Date(auctionStart).getTime()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['auctionEnd'],
        message: 'Auction end time must be after the start time.',
      });
    }
  });

export type CreateLotDto = z.infer<typeof createLotSchema>;

export const createLotSchemaResponse = z.object({
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

export type CreateLotResponseDto = z.infer<typeof createLotSchemaResponse>;
