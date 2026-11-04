import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { vi } from 'vitest';
import { AuctionStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuctionRealtimeGateway } from './auction-realtime.gateway.js';

const firstLotId = '550e8400-e29b-41d4-a716-446655440000';
const secondLotId = '550e8400-e29b-41d4-a716-446655440001';
const auctionStart = new Date('2026-11-03T12:00:00.000Z');
const auctionEnd = new Date('2026-11-03T12:30:00.000Z');
const bidCreatedAt = new Date('2026-11-03T12:10:00.000Z');

const activeLotSnapshot = {
  id: firstLotId,
  name: 'Vintage camera',
  description: 'A camera in good condition',
  startingPrice: new Prisma.Decimal('10.00'),
  currentPrice: new Prisma.Decimal('14.00'),
  auctionStart,
  auctionEnd,
  status: AuctionStatus.ACTIVE,
  createdAt: new Date('2026-11-01T10:00:00.000Z'),
  updatedAt: new Date('2026-11-03T12:10:00.000Z'),
  seller: { name: 'Seller' },
  bids: [
    {
      id: 'bid-1',
      userId: 'private-bidder-id',
      amount: new Prisma.Decimal('14.00'),
      createdAt: bidCreatedAt,
    },
  ],
};

describe('AuctionRealtimeGateway', () => {
  const createGateway = () => {
    const prismaMock = {
      lot: { findUnique: vi.fn() },
    };
    const prismaService = prismaMock as unknown as PrismaService;
    const gateway = new AuctionRealtimeGateway(prismaService);
    const rooms = new Set<string>(['socket-1']);
    const client = {
      id: 'socket-1',
      rooms,
      join: vi.fn(async (room: string) => {
        rooms.add(room);
      }),
      leave: vi.fn(async (room: string) => {
        rooms.delete(room);
      }),
      emit: vi.fn(),
    };
    const socket = client as unknown as Socket;

    return { gateway, prismaMock, client: socket, clientMock: client, rooms };
  };

  it('joins the lot room before loading and privately emits its current state', async () => {
    const { gateway, prismaMock, client, clientMock, rooms } = createGateway();
    prismaMock.lot.findUnique.mockImplementation(async () => {
      expect(rooms.has(`lot:${firstLotId}`)).toBe(true);
      return activeLotSnapshot as never;
    });

    await expect(
      gateway.joinLot(client, { lotId: firstLotId }),
    ).resolves.toEqual({ lotId: firstLotId });

    expect(clientMock.join).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(rooms.has(`lot:${firstLotId}`)).toBe(true);
    expect(clientMock.emit).toHaveBeenCalledWith('lot_state', {
      lot: {
        id: firstLotId,
        name: 'Vintage camera',
        description: 'A camera in good condition',
        startingPrice: '10.00',
        currentPrice: '14.00',
        auctionStart: auctionStart.toISOString(),
        auctionEnd: auctionEnd.toISOString(),
        status: AuctionStatus.ACTIVE,
        createdAt: activeLotSnapshot.createdAt.toISOString(),
        updatedAt: activeLotSnapshot.updatedAt.toISOString(),
        seller: { name: 'Seller' },
      },
      bids: [{ amount: '14.00', createdAt: bidCreatedAt.toISOString() }],
    });
    expect(prismaMock.lot.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: firstLotId },
        select: expect.objectContaining({
          bids: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 25,
            select: { amount: true, createdAt: true },
          },
        }),
      }),
    );
  });

  it('leaves the previous lot room when joining another lot', async () => {
    const { gateway, prismaMock, client, clientMock, rooms } = createGateway();
    rooms.add(`lot:${firstLotId}`);
    const snapshot = { ...activeLotSnapshot, id: secondLotId };
    prismaMock.lot.findUnique.mockResolvedValue({
      ...snapshot,
    } as never);

    await gateway.joinLot(client, { lotId: secondLotId });

    expect(clientMock.leave).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(clientMock.join).toHaveBeenCalledWith(`lot:${secondLotId}`);
    expect(rooms.has(`lot:${firstLotId}`)).toBe(false);
    expect(rooms.has(`lot:${secondLotId}`)).toBe(true);
    expect(clientMock.emit).toHaveBeenCalledWith(
      'lot_state',
      expect.objectContaining({
        lot: expect.objectContaining({ id: secondLotId }),
      }),
    );
  });

  it('sends an empty bid history and preserves a null current price when there are no bids', async () => {
    const { gateway, prismaMock, client, clientMock } = createGateway();
    prismaMock.lot.findUnique.mockResolvedValue({
      ...activeLotSnapshot,
      currentPrice: null,
      bids: [],
    } as never);

    await gateway.joinLot(client, { lotId: firstLotId });

    expect(clientMock.emit).toHaveBeenCalledWith(
      'lot_state',
      expect.objectContaining({
        lot: expect.objectContaining({ currentPrice: null }),
        bids: [],
      }),
    );
  });

  it('does not join a missing lot or leave the current lot room', async () => {
    const { gateway, prismaMock, client, clientMock, rooms } = createGateway();
    rooms.add(`lot:${secondLotId}`);
    prismaMock.lot.findUnique.mockResolvedValue(null);

    await expect(
      gateway.joinLot(client, { lotId: firstLotId }),
    ).rejects.toThrow(WsException);

    expect(rooms.has(`lot:${secondLotId}`)).toBe(true);
    expect(rooms.has(`lot:${firstLotId}`)).toBe(false);
    expect(clientMock.emit).not.toHaveBeenCalled();
  });

  it('cleans up the room and propagates database errors', async () => {
    const { gateway, prismaMock, client, clientMock, rooms } = createGateway();
    prismaMock.lot.findUnique.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(
      gateway.joinLot(client, { lotId: firstLotId }),
    ).rejects.toThrow('database unavailable');

    expect(rooms.has(`lot:${firstLotId}`)).toBe(false);
    expect(clientMock.emit).not.toHaveBeenCalled();
  });

  it('sends a fresh snapshot after reconnecting to the same lot', async () => {
    const { gateway, prismaMock, client, clientMock } = createGateway();
    prismaMock.lot.findUnique
      .mockResolvedValueOnce(activeLotSnapshot as never)
      .mockResolvedValueOnce({
        ...activeLotSnapshot,
        currentPrice: new Prisma.Decimal('15.00'),
        bids: [
          {
            id: 'bid-2',
            userId: 'another-private-bidder-id',
            amount: new Prisma.Decimal('15.00'),
            createdAt: new Date('2026-11-03T12:15:00.000Z'),
          },
        ],
      } as never);

    await gateway.joinLot(client, { lotId: firstLotId });
    await gateway.joinLot(client, { lotId: firstLotId });

    expect(clientMock.emit).toHaveBeenNthCalledWith(
      2,
      'lot_state',
      expect.objectContaining({
        lot: expect.objectContaining({ currentPrice: '15.00' }),
        bids: [
          {
            amount: '15.00',
            createdAt: '2026-11-03T12:15:00.000Z',
          },
        ],
      }),
    );
  });

  it('leaves the lot room when the client requests to leave', async () => {
    const { gateway, client, clientMock, rooms } = createGateway();
    rooms.add(`lot:${firstLotId}`);

    await expect(
      gateway.leaveLot(client, { lotId: firstLotId }),
    ).resolves.toEqual({ lotId: firstLotId });

    expect(clientMock.leave).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(rooms.has(`lot:${firstLotId}`)).toBe(false);
  });

  it('leaves lot rooms when the socket disconnects', async () => {
    const { gateway, client, clientMock, rooms } = createGateway();
    rooms.add(`lot:${firstLotId}`);
    rooms.add(`lot:${secondLotId}`);

    await gateway.handleDisconnect(client);

    expect(clientMock.leave).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(clientMock.leave).toHaveBeenCalledWith(`lot:${secondLotId}`);
    expect(rooms.has('socket-1')).toBe(true);
    expect([...rooms].some((room) => room.startsWith('lot:'))).toBe(false);
  });

  it('broadcasts accepted bid details only to the matching lot room', () => {
    const { gateway } = createGateway();
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    Object.defineProperty(gateway, 'server', { value: { to } });
    const event = {
      bidId: 'bid-1',
      lotId: firstLotId,
      amount: '12.00',
      currentPrice: '12.00',
      auctionEnd: '2026-11-03T12:30:00.000Z',
      createdAt: '2026-11-03T12:00:00.000Z',
    };

    gateway.broadcastBidPlaced(event);

    expect(to).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(emit).toHaveBeenCalledWith('bid_placed', event);
  });

  it('rejects invalid lot IDs when joining or leaving', async () => {
    const { gateway, prismaMock, client } = createGateway();

    await expect(gateway.joinLot(client, { lotId: 'invalid' })).rejects.toThrow(
      WsException,
    );
    await expect(
      gateway.leaveLot(client, { lotId: 'invalid' }),
    ).rejects.toThrow(WsException);
    expect(prismaMock.lot.findUnique).not.toHaveBeenCalled();
  });
});
