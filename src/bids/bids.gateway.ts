import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service.js';

const joinLotSchema = z.object({ lotId: z.uuid() }).strict();
const lotRoom = (lotId: string): string => `lot:${lotId}`;

@WebSocketGateway()
export class BidsGateway {
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

    await client.join(lotRoom(lot.id));
    return { lotId: lot.id };
  }

  broadcastAuctionExtended(lotId: string, auctionEnd: string): void {
    this.server.to(lotRoom(lotId)).emit('auction_extended', {
      lotId,
      auctionEnd,
    });
  }
}
