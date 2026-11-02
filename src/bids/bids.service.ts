import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuctionStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BidHistoryResponseDto } from './schemas/bid-history.schemas.js';
import type { MakeBidResponseDto } from './schemas/make-bid.schemas.js';

@Injectable()
export class BidsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getBidHistory(lotId: string): Promise<BidHistoryResponseDto> {
    const lot = await this.prismaService.lot.findUnique({
      where: { id: lotId },
      select: { id: true },
    });

    if (!lot) {
      throw new NotFoundException('Lot not found.');
    }

    const bids = await this.prismaService.bid.findMany({
      where: { lotId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 25,
      select: {
        id: true,
        amount: true,
        createdAt: true,
      },
    });

    return {
      lotId,
      bids: bids.map((bid) => ({
        amount: bid.amount.toFixed(2),
        createdAt: bid.createdAt.toISOString(),
      })),
    };
  }

  async makeBid(
    lotId: string,
    amount: string,
    userId: string,
  ): Promise<MakeBidResponseDto> {
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount)) {
      throw new BadRequestException(
        'Bid amount must be a positive number with up to 2 decimal places.',
      );
    }

    const bidAmount = new Prisma.Decimal(amount);
    if (bidAmount.lte(0)) {
      throw new BadRequestException('Bid amount must be greater than zero.');
    }

    return this.prismaService.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM lots WHERE id = ${lotId} FOR UPDATE
      `;

      const lot = await transaction.lot.findUnique({
        where: { id: lotId },
        select: {
          id: true,
          sellerId: true,
          status: true,
          startingPrice: true,
          currentPrice: true,
          auctionEnd: true,
        },
      });

      if (!lot) {
        throw new NotFoundException('Lot not found.');
      }

      if (lot.status !== AuctionStatus.ACTIVE) {
        throw new ConflictException('This auction is not active.');
      }

      const now = new Date();
      if (!lot.auctionEnd || lot.auctionEnd <= now) {
        throw new ConflictException('This auction has ended.');
      }

      if (lot.sellerId === userId) {
        throw new ForbiddenException('You cannot bid on your own lot.');
      }

      const previousBid = await transaction.bid.findFirst({
        where: { lotId },
        orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }],
        select: {
          amount: true,
          userId: true,
        },
      });

      const currentPrice = lot.currentPrice ?? lot.startingPrice;
      if (!bidAmount.gt(currentPrice)) {
        throw new ConflictException({
          message: 'Bid must be higher than the current price.',
          currentPrice: currentPrice.toFixed(2),
          minimumAmount: currentPrice.plus('0.01').toFixed(2),
        });
      }

      const walletUserIds = [
        ...new Set([userId, ...(previousBid ? [previousBid.userId] : [])]),
      ].sort();

      for (const walletUserId of walletUserIds) {
        await transaction.$queryRaw`
          SELECT user_id FROM wallets WHERE user_id = ${walletUserId} FOR UPDATE
        `;
      }

      const wallets = await transaction.wallet.findMany({
        where: { userId: { in: walletUserIds } },
        select: {
          userId: true,
          availableBalance: true,
          reservedBalance: true,
        },
      });
      const walletsByUserId = new Map(
        wallets.map((wallet) => [wallet.userId, wallet]),
      );
      const bidderWallet = walletsByUserId.get(userId);

      if (!bidderWallet) {
        throw new NotFoundException('Wallet not found.');
      }

      const previousBidWallet = previousBid
        ? walletsByUserId.get(previousBid.userId)
        : undefined;

      if (previousBid && !previousBidWallet) {
        throw new InternalServerErrorException(
          'Wallet for the current highest bidder was not found.',
        );
      }

      const bidderReservedAmount =
        previousBid?.userId === userId
          ? previousBid.amount
          : new Prisma.Decimal(0);

      if (
        bidderWallet.availableBalance.plus(bidderReservedAmount).lt(bidAmount)
      ) {
        throw new BadRequestException('Insufficient available balance.');
      }

      if (
        previousBid &&
        previousBidWallet &&
        previousBidWallet.reservedBalance.lt(previousBid.amount)
      ) {
        throw new InternalServerErrorException(
          'Reserved balance is inconsistent with the highest bid.',
        );
      }

      if (bidderReservedAmount.gt(0)) {
        const additionalReservation = bidAmount.minus(bidderReservedAmount);
        await transaction.wallet.update({
          where: { userId },
          data: {
            availableBalance: { decrement: additionalReservation },
            reservedBalance: { increment: additionalReservation },
          },
        });
      } else {
        if (previousBid && previousBidWallet) {
          await transaction.wallet.update({
            where: { userId: previousBid.userId },
            data: {
              availableBalance: { increment: previousBid.amount },
              reservedBalance: { decrement: previousBid.amount },
            },
          });
        }

        await transaction.wallet.update({
          where: { userId },
          data: {
            availableBalance: { decrement: bidAmount },
            reservedBalance: { increment: bidAmount },
          },
        });
      }

      const bid = await transaction.bid.create({
        data: {
          amount: bidAmount,
          lotId,
          userId,
        },
        select: { id: true },
      });

      await transaction.lot.update({
        where: { id: lotId },
        data: { currentPrice: bidAmount },
      });

      return {
        bidId: bid.id,
        lotId,
        amount: bidAmount.toFixed(2),
        currentPrice: bidAmount.toFixed(2),
        auctionEnd: lot.auctionEnd.toISOString(),
      };
    });
  }
}
