import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { BidsGateway } from './bids.gateway.js';

const firstLotId = '550e8400-e29b-41d4-a716-446655440000';
const secondLotId = '550e8400-e29b-41d4-a716-446655440001';

describe('BidsGateway', () => {
  const createGateway = () => {
    const prismaService = {
      lot: { findUnique: vi.fn() },
    } as unknown as PrismaService;
    const gateway = new BidsGateway(prismaService);
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
    } as unknown as Socket;

    return { gateway, prismaService, client, rooms };
  };

  it('joins the requested lot room', async () => {
    const { gateway, prismaService, client, rooms } = createGateway();
    vi.mocked(prismaService.lot.findUnique).mockResolvedValue({
      id: firstLotId,
    } as never);

    await expect(
      gateway.joinLot(client, { lotId: firstLotId }),
    ).resolves.toEqual({ lotId: firstLotId });

    expect(client.join).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(rooms.has(`lot:${firstLotId}`)).toBe(true);
  });

  it('leaves the previous lot room when joining another lot', async () => {
    const { gateway, prismaService, client, rooms } = createGateway();
    rooms.add(`lot:${firstLotId}`);
    vi.mocked(prismaService.lot.findUnique).mockResolvedValue({
      id: secondLotId,
    } as never);

    await gateway.joinLot(client, { lotId: secondLotId });

    expect(client.leave).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(client.join).toHaveBeenCalledWith(`lot:${secondLotId}`);
    expect(rooms.has(`lot:${firstLotId}`)).toBe(false);
    expect(rooms.has(`lot:${secondLotId}`)).toBe(true);
  });

  it('leaves the lot room when the client requests to leave', async () => {
    const { gateway, client, rooms } = createGateway();
    rooms.add(`lot:${firstLotId}`);

    await expect(
      gateway.leaveLot(client, { lotId: firstLotId }),
    ).resolves.toEqual({ lotId: firstLotId });

    expect(client.leave).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(rooms.has(`lot:${firstLotId}`)).toBe(false);
  });

  it('leaves lot rooms when the socket disconnects', async () => {
    const { gateway, client, rooms } = createGateway();
    rooms.add(`lot:${firstLotId}`);
    rooms.add(`lot:${secondLotId}`);

    await gateway.handleDisconnect(client);

    expect(client.leave).toHaveBeenCalledWith(`lot:${firstLotId}`);
    expect(client.leave).toHaveBeenCalledWith(`lot:${secondLotId}`);
    expect(rooms.has('socket-1')).toBe(true);
    expect([...rooms].some((room) => room.startsWith('lot:'))).toBe(false);
  });

  it('rejects invalid lot IDs when joining or leaving', async () => {
    const { gateway, prismaService, client } = createGateway();

    await expect(gateway.joinLot(client, { lotId: 'invalid' })).rejects.toThrow(
      WsException,
    );
    await expect(
      gateway.leaveLot(client, { lotId: 'invalid' }),
    ).rejects.toThrow(WsException);
    expect(prismaService.lot.findUnique).not.toHaveBeenCalled();
  });
});
