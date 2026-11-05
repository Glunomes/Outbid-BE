import { AuctionStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LotsService } from './lots.service.js';
import { vi } from 'vitest';

describe('LotsService.getMyLots', () => {
  const sellerId = '550e8400-e29b-41d4-a716-446655440001';
  const lotId = '550e8400-e29b-41d4-a716-446655440002';
  const createdAt = new Date('2026-11-01T10:00:00.000Z');

  it('returns all statuses for the authenticated seller with pagination', async () => {
    const lotFindMany = vi.fn().mockResolvedValue([
      {
        id: lotId,
        name: 'Draft lot',
        description: null,
        startingPrice: new Prisma.Decimal('25.00'),
        currentPrice: null,
        auctionStart: null,
        auctionEnd: null,
        status: AuctionStatus.DRAFT,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Cancelled lot',
        description: 'No longer available',
        startingPrice: new Prisma.Decimal('10.00'),
        currentPrice: null,
        auctionStart: null,
        auctionEnd: null,
        status: AuctionStatus.CANCELLED,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    const lotCount = vi.fn().mockResolvedValue(2);
    const prismaMock = {
      lot: { findMany: lotFindMany, count: lotCount },
      $transaction: vi.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
    };
    const service = new LotsService(prismaMock as unknown as PrismaService);

    await expect(
      service.getMyLots(sellerId, { page: 2, limit: 5 }),
    ).resolves.toEqual({
      lots: [
        {
          id: lotId,
          name: 'Draft lot',
          description: null,
          startingPrice: '25.00',
          currentPrice: null,
          auctionStart: null,
          auctionEnd: null,
          status: AuctionStatus.DRAFT,
          createdAt: createdAt.toISOString(),
          updatedAt: createdAt.toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Cancelled lot',
          description: 'No longer available',
          startingPrice: '10.00',
          currentPrice: null,
          auctionStart: null,
          auctionEnd: null,
          status: AuctionStatus.CANCELLED,
          createdAt: createdAt.toISOString(),
          updatedAt: createdAt.toISOString(),
        },
      ],
      page: 2,
      limit: 5,
      total: 2,
      totalPages: 1,
    });

    expect(lotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerId },
        skip: 5,
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(lotCount).toHaveBeenCalledWith({ where: { sellerId } });
  });

  it('rejects invalid pagination before querying the database', async () => {
    const prismaMock = {
      lot: { findMany: vi.fn(), count: vi.fn() },
      $transaction: vi.fn(),
    };
    const service = new LotsService(prismaMock as unknown as PrismaService);

    await expect(service.getMyLots(sellerId, { page: 0 })).rejects.toThrow(
      'Page must be a positive integer.',
    );
    expect(prismaMock.lot.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
