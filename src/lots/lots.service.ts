import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateLotDto,
  CreateLotResponseDto,
} from './schemas/create-lots.schemas.js';
import type {
  UpdateLotDto,
  UpdateLotResponseDto,
} from './schemas/update-lots.schemas.js';
import { Prisma } from '../generated/prisma/client.js';
import { AuctionStatus } from '../generated/prisma/enums.js';

@Injectable()
export class LotsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createLot(
    dto: CreateLotDto,
    sellerId: string,
  ): Promise<CreateLotResponseDto> {
    const startingPrice = new Prisma.Decimal(dto.startingPrice);
    const lot = await this.prismaService.lot.create({
      data: {
        name: dto.name,
        description: dto.description,
        startingPrice,
        auctionStart: dto.auctionStart ? new Date(dto.auctionStart) : null,
        auctionEnd: dto.auctionEnd ? new Date(dto.auctionEnd) : null,
        status: dto.auctionStart
          ? AuctionStatus.SCHEDULED
          : AuctionStatus.DRAFT,
        sellerId,
      },
      select: {
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
      },
    });

    return {
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
    };
  }

  async updateLot(
    lotId: string,
    dto: UpdateLotDto,
    sellerId: string,
  ): Promise<UpdateLotResponseDto> {
    const existingLot = await this.prismaService.lot.findUnique({
      where: {
        id: lotId,
        sellerId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existingLot) {
      throw new NotFoundException('Lot not found');
    }

    if (
      existingLot.status !== AuctionStatus.DRAFT &&
      existingLot.status !== AuctionStatus.SCHEDULED
    ) {
      throw new ConflictException(
        'Only draft or scheduled lots can be updated.',
      );
    }

    const lot = await this.prismaService.lot.update({
      where: { id: lotId },
      data: {
        name: dto.name,
        description: dto.description,
        startingPrice: new Prisma.Decimal(dto.startingPrice),
        auctionStart: dto.auctionStart ? new Date(dto.auctionStart) : null,
        auctionEnd: dto.auctionEnd ? new Date(dto.auctionEnd) : null,
        status: dto.auctionStart
          ? AuctionStatus.SCHEDULED
          : AuctionStatus.DRAFT,
      },
      select: {
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
      },
    });

    return {
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
    };
  }
}
