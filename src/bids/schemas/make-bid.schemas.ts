import { z } from 'zod';

export const makeBidSchema = z
  .object({
    amount: z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
        'Enter a valid amount with up to 2 decimal places',
      )
      .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  })
  .strict();

export type MakeBidDto = z.infer<typeof makeBidSchema>;

export const makeBidResponseSchema = z.object({
  bidId: z.uuid(),
  lotId: z.uuid(),
  amount: z.string(),
  currentPrice: z.string(),
  auctionEnd: z.iso.datetime(),
});

export type MakeBidResponseDto = z.infer<typeof makeBidResponseSchema>;
