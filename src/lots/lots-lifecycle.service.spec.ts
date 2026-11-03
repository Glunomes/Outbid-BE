import { AuctionStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LotsLifecycleService } from './lots-lifecycle.service.js';
import { vi } from 'vitest';

describe('LotsLifecycleService', () => {
  const lotId = '550e8400-e29b-41d4-a716-446655440000';
  const sellerId = '550e8400-e29b-41d4-a716-446655440001';
  const winnerId = '550e8400-e29b-41d4-a716-446655440002';
  const now = new Date('2026-11-03T12:00:00.000Z');
  const expiredAt = new Date('2026-11-03T11:59:00.000Z');

  const createService = () => {
    const prismaMock = {
      lot: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(),
    };
    const transaction = {
      $queryRaw: vi.fn(),
      lot: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      bid: {
        findFirst: vi.fn(),
      },
      wallet: {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
    );
    const service = new LotsLifecycleService(
      prismaMock as unknown as PrismaService,
    );

    return { service, prismaMock, transaction };
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('activates scheduled lots and checks expired lots on startup', async () => {
    const { service, prismaMock } = createService();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await service.onModuleInit();

    expect(prismaMock.lot.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: AuctionStatus.SCHEDULED,
        auctionStart: { lte: now },
      },
      data: { status: AuctionStatus.ACTIVE },
    });
    expect(prismaMock.lot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: AuctionStatus.ACTIVE,
              auctionEnd: { lte: now },
            }),
          ]),
        }),
      }),
    );
    expect(prismaMock.lot.updateMany).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
  });

  it('checks for expired lots periodically', async () => {
    const { service, prismaMock } = createService();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T12:00:00.000Z'));

    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(prismaMock.lot.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.lot.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: AuctionStatus.ACTIVE,
              auctionEnd: { lte: new Date('2026-11-03T12:00:05.000Z') },
            }),
          ]),
        }),
      }),
    );

    service.onModuleDestroy();
  });

  it('settles an ended lot by paying the seller and consuming the winner reserve', async () => {
    const { service, prismaMock, transaction } = createService();
    const winningAmount = new Prisma.Decimal('25.00');
    prismaMock.lot.findMany.mockResolvedValue([{ id: lotId }]);
    transaction.lot.findUnique.mockResolvedValue({
      id: lotId,
      status: AuctionStatus.ACTIVE,
      auctionEnd: expiredAt,
      winnerId: null,
      sellerId,
    });
    transaction.bid.findFirst.mockResolvedValue({
      userId: winnerId,
      amount: winningAmount,
    });
    transaction.wallet.findMany.mockResolvedValue([
      {
        userId: sellerId,
        availableBalance: new Prisma.Decimal('10.00'),
        reservedBalance: new Prisma.Decimal('0.00'),
      },
      {
        userId: winnerId,
        availableBalance: new Prisma.Decimal('0.00'),
        reservedBalance: winningAmount,
      },
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await service.onModuleInit();

    expect(prismaMock.lot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: AuctionStatus.ACTIVE,
              auctionEnd: { lte: now },
            }),
          ]),
        }),
      }),
    );
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(3);
    expect(transaction.bid.findFirst).toHaveBeenCalledWith({
      where: { lotId },
      orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: { userId: true, amount: true },
    });
    expect(transaction.wallet.update).toHaveBeenCalledWith({
      where: { userId: winnerId },
      data: { reservedBalance: { decrement: winningAmount } },
    });
    expect(transaction.wallet.update).toHaveBeenCalledWith({
      where: { userId: sellerId },
      data: { availableBalance: { increment: winningAmount } },
    });
    expect(transaction.lot.update).toHaveBeenCalledWith({
      where: { id: lotId },
      data: { status: AuctionStatus.ENDED, winnerId },
    });

    service.onModuleDestroy();
  });

  it('settles an ended lot left by the previous lifecycle processor', async () => {
    const { service, prismaMock, transaction } = createService();
    const winningAmount = new Prisma.Decimal('25.00');
    prismaMock.lot.findMany.mockResolvedValue([{ id: lotId }]);
    transaction.lot.findUnique.mockResolvedValue({
      id: lotId,
      status: AuctionStatus.ENDED,
      auctionEnd: expiredAt,
      winnerId: null,
      sellerId,
    });
    transaction.bid.findFirst.mockResolvedValue({
      userId: winnerId,
      amount: winningAmount,
    });
    transaction.wallet.findMany.mockResolvedValue([
      {
        userId: sellerId,
        availableBalance: new Prisma.Decimal('10.00'),
        reservedBalance: new Prisma.Decimal('0.00'),
      },
      {
        userId: winnerId,
        availableBalance: new Prisma.Decimal('0.00'),
        reservedBalance: winningAmount,
      },
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await service.onModuleInit();

    expect(prismaMock.lot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: AuctionStatus.ENDED,
              winnerId: null,
              bids: { some: {} },
            }),
          ]),
        }),
      }),
    );
    expect(transaction.wallet.update).toHaveBeenCalledTimes(2);
    expect(transaction.lot.update).toHaveBeenCalledWith({
      where: { id: lotId },
      data: { status: AuctionStatus.ENDED, winnerId },
    });

    service.onModuleDestroy();
  });

  it('ends a lot without bids without touching wallets or assigning a winner', async () => {
    const { service, prismaMock, transaction } = createService();
    prismaMock.lot.findMany.mockResolvedValue([{ id: lotId }]);
    transaction.lot.findUnique.mockResolvedValue({
      id: lotId,
      status: AuctionStatus.ACTIVE,
      auctionEnd: expiredAt,
      winnerId: null,
      sellerId,
    });
    transaction.bid.findFirst.mockResolvedValue(null);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await service.onModuleInit();

    expect(transaction.wallet.findMany).not.toHaveBeenCalled();
    expect(transaction.wallet.update).not.toHaveBeenCalled();
    expect(transaction.lot.update).toHaveBeenCalledWith({
      where: { id: lotId },
      data: { status: AuctionStatus.ENDED },
    });

    service.onModuleDestroy();
  });

  it('does not settle a lot a second time after its winner has been recorded', async () => {
    const { service, prismaMock, transaction } = createService();
    prismaMock.lot.findMany.mockResolvedValue([{ id: lotId }]);
    transaction.lot.findUnique.mockResolvedValue({
      id: lotId,
      status: AuctionStatus.ENDED,
      auctionEnd: expiredAt,
      winnerId,
      sellerId,
    });
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await service.onModuleInit();

    expect(transaction.bid.findFirst).not.toHaveBeenCalled();
    expect(transaction.wallet.findMany).not.toHaveBeenCalled();
    expect(transaction.wallet.update).not.toHaveBeenCalled();
    expect(transaction.lot.update).not.toHaveBeenCalled();

    service.onModuleDestroy();
  });

  it('does not pay out when the winning bid reserve is inconsistent', async () => {
    const { service, prismaMock, transaction } = createService();
    const winningAmount = new Prisma.Decimal('25.00');
    prismaMock.lot.findMany.mockResolvedValue([{ id: lotId }]);
    transaction.lot.findUnique.mockResolvedValue({
      id: lotId,
      status: AuctionStatus.ENDED,
      auctionEnd: expiredAt,
      winnerId: null,
      sellerId,
    });
    transaction.bid.findFirst.mockResolvedValue({
      userId: winnerId,
      amount: winningAmount,
    });
    transaction.wallet.findMany.mockResolvedValue([
      {
        userId: sellerId,
        availableBalance: new Prisma.Decimal('10.00'),
        reservedBalance: new Prisma.Decimal('0.00'),
      },
      {
        userId: winnerId,
        availableBalance: new Prisma.Decimal('0.00'),
        reservedBalance: new Prisma.Decimal('24.00'),
      },
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await service.onModuleInit();

    expect(transaction.wallet.update).not.toHaveBeenCalled();
    expect(transaction.lot.update).not.toHaveBeenCalled();

    service.onModuleDestroy();
  });
});
