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
import { PrismaService } from '../prisma/prisma.service.js';

const joinLotSchema = z.object({ lotId: z.uuid() }).strict();
const LOT_ROOM_PREFIX = 'lot:';
const lotRoom = (lotId: string): string => `${LOT_ROOM_PREFIX}${lotId}`;

@WebSocketGateway()
export class BidsGateway implements OnGatewayDisconnect {
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

    const lot = await this.prismaService.lot.findUnique({
      where: { id: result.data.lotId },
      select: { id: true },
    });

    if (!lot) {
      throw new WsException('Lot not found.');
    }

    const previousLotRooms = [...client.rooms].filter((room) =>
      room.startsWith(LOT_ROOM_PREFIX),
    );
    await Promise.all(previousLotRooms.map((room) => client.leave(room)));
    await client.join(lotRoom(lot.id));
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
    await Promise.all(lotRooms.map((room) => client.leave(room)));
  }

  broadcastAuctionExtended(lotId: string, auctionEnd: string): void {
    this.server.to(lotRoom(lotId)).emit('auction_extended', {
      lotId,
      auctionEnd,
    });
  }
}
