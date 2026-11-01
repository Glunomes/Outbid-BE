import { z } from 'zod';

export const walletResponseSchema = z.object({
  availableBalance: z.string(),
  reservedBalance: z.string(),
});

export type WalletResponseDto = z.infer<typeof walletResponseSchema>;

export const walletDepositSchema = z.object({
  amount: z
    .string()
    .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
}).strict();

export type WalletDepositDto = z.infer<typeof walletDepositSchema>;