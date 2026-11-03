import { AuctionStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LotsLifecycleService } from './lots-lifecycle.service.js';
import { vi } from 'vitest';

describe('LotsLifecycleService', () => {
  const createService = () => {
    const prismaMock = {
      lot: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new LotsLifecycleService(
      prismaMock as unknown as PrismaService,
    );

    return { service, prismaMock };
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('activates scheduled lots and ends expired active lots on startup', async () => {
    const { service, prismaMock } = createService();
    const now = new Date('2026-11-03T12:00:00.000Z');
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
    expect(prismaMock.lot.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: AuctionStatus.ACTIVE,
        auctionEnd: { lte: now },
      },
      data: { status: AuctionStatus.ENDED },
    });

    service.onModuleDestroy();
  });

  it('checks for expired lots periodically', async () => {
    const { service, prismaMock } = createService();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T12:00:00.000Z'));

    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(prismaMock.lot.updateMany).toHaveBeenCalledTimes(4);
    expect(prismaMock.lot.updateMany).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: expect.objectContaining({
          status: AuctionStatus.ACTIVE,
          auctionEnd: { lte: new Date('2026-11-03T12:00:05.000Z') },
        }),
        data: { status: AuctionStatus.ENDED },
      }),
    );

    service.onModuleDestroy();
  });
});
