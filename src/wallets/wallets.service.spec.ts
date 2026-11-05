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

  it('reports a missing wallet instead of returning an empty balance', async () => {
    const service = new WalletsService({
      wallet: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(service.getWallet('missing-user')).rejects.toThrow(
      NotFoundException,
    );
  });
});
