import { z } from 'zod';

export const bidHistoryResponseSchema = z.object({
  lotId: z.uuid(),
  bids: z.array(
    z.object({
      amount: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
});

export type BidHistoryResponseDto = z.infer<typeof bidHistoryResponseSchema>;
