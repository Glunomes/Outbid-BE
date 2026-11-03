import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateLotDto,
  LotResponseDto,
} from './schemas/create-lots.schemas.js';
import type {
  UpdateLotDto,
  UpdateLotResponseDto,
} from './schemas/update-lots.schemas.js';
import type {
  LotCatalogItemDto,
  LotsCatalogOptions,
  LotsCatalogResponseDto,
} from './interfaces/lots-catalog.interfaces.js';
import { Prisma } from '../generated/prisma/client.js';
import { AuctionStatus } from '../generated/prisma/enums.js';

const lotResponseSelect = {
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
} satisfies Prisma.LotSelect;

const lotCardSelect = {
  ...lotResponseSelect,
  seller: { select: { name: true } },
} satisfies Prisma.LotSelect;

type LotResponseRecord = Prisma.LotGetPayload<{
  select: typeof lotResponseSelect;
}>;

type LotCardRecord = Prisma.LotGetPayload<{
  select: typeof lotCardSelect;
}>;

export type LotCardResponseDto = LotResponseDto & { seller: { name: string } };

const toLotResponse = (lot: LotResponseRecord): LotResponseDto => ({
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
});

const toLotCardResponse = (lot: LotCardRecord): LotCardResponseDto => ({
  ...toLotResponse(lot),
  seller: lot.seller,
});

@Injectable()
export class LotsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getLots({
    page = 1,
    limit = 25,
    name,
    status,
    auctionStartFrom,
    auctionStartTo,
  }: LotsCatalogOptions = {}): Promise<LotsCatalogResponseDto> {
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer.');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100.');
    }

    const conditions: Prisma.LotWhereInput[] = [
      { status: { notIn: [AuctionStatus.DRAFT, AuctionStatus.CANCELLED] } },
    ];

    if (name) {
      conditions.push({
        name: { contains: name.trim(), mode: 'insensitive' },
      });
    }

    if (status) {
      conditions.push({ status });
    }

    if (auctionStartFrom || auctionStartTo) {
      conditions.push({
        auctionStart: {
          ...(auctionStartFrom ? { gte: new Date(auctionStartFrom) } : {}),
          ...(auctionStartTo ? { lte: new Date(auctionStartTo) } : {}),
        },
      });
    }

    const where: Prisma.LotWhereInput = { AND: conditions };

    const [lots, total] = await this.prismaService.$transaction([
      this.prismaService.lot.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          startingPrice: true,
          currentPrice: true,
          auctionStart: true,
          auctionEnd: true,
          status: true,
        },
      }),
      this.prismaService.lot.count({ where }),
    ]);

    return {
      lots: lots.map((lot): LotCatalogItemDto => ({
        id: lot.id,
        name: lot.name,
        description: lot.description,
        price: (lot.currentPrice ?? lot.startingPrice).toFixed(2),
        auctionStart: lot.auctionStart?.toISOString() ?? null,
        auctionEnd: lot.auctionEnd?.toISOString() ?? null,
        status: lot.status,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createLot(
    dto: CreateLotDto,
    sellerId: string,
  ): Promise<LotResponseDto> {
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
      select: lotResponseSelect,
    });

    return toLotResponse(lot);
  }

  async updateLot(
    lotId: string,
    dto: UpdateLotDto,
    sellerId: string,
  ): Promise<UpdateLotResponseDto> {
    const lot = await this.prismaService.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM lots WHERE id = ${lotId} FOR UPDATE
      `;

      const existingLot = await transaction.lot.findUnique({
        where: { id: lotId, sellerId },
        select: {
          id: true,
          status: true,
          auctionStart: true,
          auctionEnd: true,
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

      if (
        existingLot.status === AuctionStatus.SCHEDULED &&
        existingLot.auctionStart !== null &&
        existingLot.auctionStart <= new Date()
      ) {
        throw new ConflictException(
          'A scheduled auction cannot be updated after it has started.',
        );
      }

      if (
        existingLot.status === AuctionStatus.SCHEDULED &&
        (this.isDateChanged(dto.auctionStart, existingLot.auctionStart) ||
          this.isDateChanged(dto.auctionEnd, existingLot.auctionEnd))
      ) {
        throw new ConflictException(
          'Auction schedule cannot be changed after it is scheduled.',
        );
      }

      return transaction.lot.update({
        where: { id: lotId },
        data: {
          name: dto.name,
          description: dto.description,
          startingPrice: new Prisma.Decimal(dto.startingPrice),
          ...(existingLot.status === AuctionStatus.DRAFT
            ? {
                auctionStart: dto.auctionStart
                  ? new Date(dto.auctionStart)
                  : null,
                auctionEnd: dto.auctionEnd ? new Date(dto.auctionEnd) : null,
                status: dto.auctionStart
                  ? AuctionStatus.SCHEDULED
                  : AuctionStatus.DRAFT,
              }
            : {}),
        },
        select: lotResponseSelect,
      });
    });

    return toLotResponse(lot);
  }

  async cancelLot(
    lotId: string,
    sellerId: string,
  ): Promise<{ lotId: string; cancelled: true }> {
    await this.prismaService.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM lots WHERE id = ${lotId} FOR UPDATE
      `;

      const lot = await transaction.lot.findUnique({
        where: { id: lotId, sellerId },
        select: {
          id: true,
          status: true,
          auctionEnd: true,
          _count: { select: { bids: true } },
        },
      });

      if (!lot) {
        throw new NotFoundException('Lot not found');
      }

      if (
        lot.status === AuctionStatus.CANCELLED ||
        lot.status === AuctionStatus.ENDED ||
        (lot.status === AuctionStatus.ACTIVE &&
          lot.auctionEnd !== null &&
          lot.auctionEnd <= new Date())
      ) {
        throw new ConflictException('This auction cannot be cancelled.');
      }

      if (lot._count.bids > 0) {
        throw new ConflictException(
          'An auction with bids cannot be cancelled.',
        );
      }

      await transaction.lot.update({
        where: { id: lotId },
        data: { status: AuctionStatus.CANCELLED },
      });
    });

    return { lotId, cancelled: true };
  }

  private isDateChanged(
    requestedDate: string | null,
    currentDate: Date | null,
  ): boolean {
    if (requestedDate === null || currentDate === null) {
      return requestedDate !== null || currentDate !== null;
    }

    return new Date(requestedDate).getTime() !== currentDate.getTime();
  }

  async getLot(lotId: string): Promise<LotCardResponseDto> {
    const lot = await this.prismaService.lot.findUnique({
      where: { id: lotId },
      select: lotCardSelect,
    });

    if (!lot) {
      throw new NotFoundException('Lot not found');
    }

    return toLotCardResponse(lot);
  }
}
