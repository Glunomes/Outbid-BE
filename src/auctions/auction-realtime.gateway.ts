import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BidPlacedEvent } from './types/bid-placed-event.js';
import type { LotStateEvent } from './types/lot-state-event.js';

const joinLotSchema = z.object({ lotId: z.uuid() }).strict();
const LOT_ROOM_PREFIX = 'lot:';
const lotRoom = (lotId: string): string => `${LOT_ROOM_PREFIX}${lotId}`;
const lotStateSelect = {
  id: true,
  name: true,
  description: true,
  startingPrice: true,
  currentPrice: true,
  auctionStart: true,
  auctionEnd: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  seller: { select: { name: true } },
  bids: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 25,
    select: { amount: true, createdAt: true },
  },
} satisfies Prisma.LotSelect;
type LotStateRecord = Prisma.LotGetPayload<{ select: typeof lotStateSelect }>;

@WebSocketGateway()
export class AuctionRealtimeGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(private readonly prismaService: PrismaService) {}

  @SubscribeMessage('join_lot')
  async joinLot(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<{ lotId: string }> {
    const result = joinLotSchema.safeParse(payload);
    if (!result.success) {
      throw new WsException('lotId must be a UUID.');
    }

    const room = lotRoom(result.data.lotId);
    const alreadyInRoom = client.rooms.has(room);
    if (!alreadyInRoom) {
      await client.join(room);
    }

    let lot: LotStateRecord | null;
    try {
      lot = await this.prismaService.lot.findUnique({
        where: { id: result.data.lotId },
        select: lotStateSelect,
      });
    } catch (error) {
      if (!alreadyInRoom) {
        await client.leave(room);
      }
      throw error;
    }

    if (!lot) {
      await client.leave(room);
      throw new WsException('Lot not found.');
    }

    const previousLotRooms = [...client.rooms].filter(
      (room) => room.startsWith(LOT_ROOM_PREFIX) && room !== lotRoom(lot.id),
    );
    await Promise.all(
      previousLotRooms.map(async (previousRoom) => client.leave(previousRoom)),
    );

    const snapshot: LotStateEvent = {
      lot: {
        id: lot.id,
        name: lot.name,
        description: lot.description,
        startingPrice: lot.startingPrice.toFixed(2),
        currentPrice: lot.currentPrice?.toFixed(2) ?? null,
        auctionStart: lot.auctionStart?.toISOString() ?? null,
        auctionEnd: lot.auctionEnd?.toISOString() ?? null,
        status: lot.status,
        createdAt: lot.createdAt.toISOString(),
        updatedAt: lot.updatedAt.toISOString(),
        seller: lot.seller,
      },
      bids: lot.bids.map((bid) => ({
        amount: bid.amount.toFixed(2),
        createdAt: bid.createdAt.toISOString(),
      })),
    };
    client.emit('lot_state', snapshot);

    return { lotId: lot.id };
  }

  @SubscribeMessage('leave_lot')
  async leaveLot(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<{ lotId: string }> {
    const result = joinLotSchema.safeParse(payload);
    if (!result.success) {
      throw new WsException('lotId must be a UUID.');
    }

    await client.leave(lotRoom(result.data.lotId));
    return { lotId: result.data.lotId };
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const lotRooms = [...client.rooms].filter((room) =>
      room.startsWith(LOT_ROOM_PREFIX),
    );
    await Promise.all(lotRooms.map(async (room) => client.leave(room)));
  }

  broadcastBidPlaced(event: BidPlacedEvent): void {
    this.server.to(lotRoom(event.lotId)).emit('bid_placed', event);
  }

  broadcastAuctionExtended(lotId: string, auctionEnd: string): void {
    this.server.to(lotRoom(lotId)).emit('auction_extended', {
      lotId,
      auctionEnd,
    });
  }
}
