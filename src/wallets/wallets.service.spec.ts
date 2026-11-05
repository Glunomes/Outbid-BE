import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletsService } from './wallets.service.js';
import { vi } from 'vitest';

describe('WalletsService.getWallet', () => {
  it('returns available and reserved balances for the requested user', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440001';
    const findUnique = vi.fn().mockResolvedValue({
      availableBalance: new Prisma.Decimal('120.50'),
      reservedBalance: new Prisma.Decimal('35.25'),
    });
    const service = new WalletsService({
      wallet: { findUnique },
    } as unknown as PrismaService);

    await expect(service.getWallet(userId)).resolves.toEqual({
      availableBalance: '120.50',
      reservedBalance: '35.25',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId },
      select: { availableBalance: true, reservedBalance: true },
    });
  });

  describe('WalletsService.deposit', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440001';

    it('adds a valid amount to available balance and returns the updated wallet', async () => {
      const findUnique = vi.fn().mockResolvedValue({ userId });
      const update = vi.fn().mockResolvedValue({
        availableBalance: new Prisma.Decimal('25.50'),
        reservedBalance: new Prisma.Decimal('10.00'),
      });
      const service = new WalletsService({
        wallet: { findUnique, update },
      } as unknown as PrismaService);

      await expect(service.deposit('5.50', userId)).resolves.toEqual({
        availableBalance: '25.50',
        reservedBalance: '10.00',
      });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          data: {
            availableBalance: {
              increment: new Prisma.Decimal('5.50'),
            },
          },
        }),
      );
    });

    it.each(['0', '-1', '1.999', '10000000000'])(
      'rejects invalid deposit amount %s',
      async (amount) => {
        const findUnique = vi.fn();
        const update = vi.fn();
        const service = new WalletsService({
          wallet: { findUnique, update },
        } as unknown as PrismaService);

        await expect(service.deposit(amount, userId)).rejects.toThrow(
          'Deposit amount',
        );
        expect(findUnique).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
      },
    );
  });

  it('reports a missing wallet instead of returning an empty balance', async () => {
    const service = new WalletsService({
      wallet: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(service.getWallet('missing-user')).rejects.toThrow(
      NotFoundException,
    );
  });
});
