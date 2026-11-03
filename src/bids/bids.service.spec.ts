import { AuctionStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuctionRealtimeGateway } from '../auctions/auction-realtime.gateway.js';
import { BidsService } from './bids.service.js';
import { vi } from 'vitest';

describe('BidsService live events', () => {
  const lotId = '550e8400-e29b-41d4-a716-446655440000';
  const bidderId = '550e8400-e29b-41d4-a716-446655440001';
  const sellerId = '550e8400-e29b-41d4-a716-446655440002';

  const createService = (auctionEnd: Date) => {
    let transactionCompleted = false;
    const transaction = {
      $queryRaw: vi.fn(),
      lot: {
        findUnique: vi.fn().mockResolvedValue({
          id: lotId,
          sellerId,
          status: AuctionStatus.ACTIVE,
          startingPrice: new Prisma.Decimal('10.00'),
          currentPrice: null,
          auctionEnd,
        }),
        update: vi.fn(),
      },
      bid: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'bid-1' }),
      },
      wallet: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: bidderId,
            availableBalance: new Prisma.Decimal('100.00'),
            reservedBalance: new Prisma.Decimal('0.00'),
          },
        ]),
        update: vi.fn(),
      },
    };
    const prismaMock = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => unknown) => {
          const result = await callback(transaction);
          transactionCompleted = true;
          return result;
        },
      ),
    };
    const prismaService = prismaMock as unknown as PrismaService;
    const auctionRealtimeGatewayMock = {
      broadcastBidPlaced: vi.fn(() => {
        expect(transactionCompleted).toBe(true);
      }),
      broadcastAuctionExtended: vi.fn(),
    };
    const auctionRealtimeGateway =
      auctionRealtimeGatewayMock as unknown as AuctionRealtimeGateway;
    const service = new BidsService(prismaService, auctionRealtimeGateway);

    return { service, prismaMock, auctionRealtimeGatewayMock };
  };

  it('broadcasts the committed bid details to lot participants', async () => {
    const auctionEnd = new Date(Date.now() + 60_000);
    const { service, auctionRealtimeGatewayMock } = createService(auctionEnd);

    await expect(service.makeBid(lotId, '12.50', bidderId)).resolves.toEqual({
      bidId: 'bid-1',
      lotId,
      amount: '12.50',
      currentPrice: '12.50',
      auctionEnd: auctionEnd.toISOString(),
    });

    expect(auctionRealtimeGatewayMock.broadcastBidPlaced).toHaveBeenCalledWith({
      bidId: 'bid-1',
      lotId,
      amount: '12.50',
      currentPrice: '12.50',
      auctionEnd: auctionEnd.toISOString(),
    });
    expect(
      auctionRealtimeGatewayMock.broadcastAuctionExtended,
    ).not.toHaveBeenCalled();
  });

  it('broadcasts the extended end time with the accepted bid', async () => {
    const auctionEnd = new Date(Date.now() + 10_000);
    const { service, auctionRealtimeGatewayMock } = createService(auctionEnd);

    const response = await service.makeBid(lotId, '12.50', bidderId);

    expect(auctionRealtimeGatewayMock.broadcastBidPlaced).toHaveBeenCalledWith(
      response,
    );
    expect(response.auctionEnd).toBe(
      new Date(auctionEnd.getTime() + 2 * 60_000).toISOString(),
    );
    expect(
      auctionRealtimeGatewayMock.broadcastAuctionExtended,
    ).toHaveBeenCalledWith(lotId, response.auctionEnd);
  });

  it('does not broadcast a bid when the transaction fails', async () => {
    const { service, prismaMock, auctionRealtimeGatewayMock } = createService(
      new Date(Date.now() + 60_000),
    );
    prismaMock.$transaction.mockRejectedValue(new Error('transaction failed'));

    await expect(service.makeBid(lotId, '12.50', bidderId)).rejects.toThrow(
      'transaction failed',
    );
    expect(
      auctionRealtimeGatewayMock.broadcastBidPlaced,
    ).not.toHaveBeenCalled();
  });
});
