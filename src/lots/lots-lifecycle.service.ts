import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AuctionStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const LIFECYCLE_CHECK_INTERVAL_MS = 5_000;

@Injectable()
export class LotsLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LotsLifecycleService.name);
  private interval: ReturnType<typeof setInterval> | undefined;
  private isProcessing = false;

  constructor(private readonly prismaService: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.processDueLots();
    this.interval = setInterval(
      () => void this.processDueLots(),
      LIFECYCLE_CHECK_INTERVAL_MS,
    );
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async processDueLots(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();
      const activated = await this.prismaService.lot.updateMany({
        where: {
          status: AuctionStatus.SCHEDULED,
          auctionStart: { lte: now },
        },
        data: { status: AuctionStatus.ACTIVE },
      });

      if (activated.count > 0) {
        this.logger.log(`Activated ${activated.count} scheduled auction(s).`);
      }

      const expiredLots = await this.prismaService.lot.findMany({
        where: {
          OR: [
            {
              status: AuctionStatus.ACTIVE,
              auctionEnd: { lte: now },
            },
            {
              status: AuctionStatus.ENDED,
              winnerId: null,
              bids: { some: {} },
            },
          ],
        },
        select: { id: true },
      });

      for (const { id } of expiredLots) {
        try {
          const settled = await this.settleExpiredLot(id, now);
          if (settled) {
            this.logger.log(`Settled auction ${id}.`);
          }
        } catch (error) {
          this.logger.error(
            `Failed to settle auction ${id}.`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to process auction lifecycle.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async settleExpiredLot(lotId: string, now: Date): Promise<boolean> {
    return this.prismaService.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM lots WHERE id = ${lotId} FOR UPDATE
      `;

      const lot = await transaction.lot.findUnique({
        where: { id: lotId },
        select: {
          id: true,
          status: true,
          auctionEnd: true,
          winnerId: true,
          sellerId: true,
        },
      });

      if (!lot || lot.winnerId !== null) {
        return false;
      }

      if (
        lot.status !== AuctionStatus.ENDED &&
        (lot.status !== AuctionStatus.ACTIVE ||
          lot.auctionEnd === null ||
          lot.auctionEnd > now)
      ) {
        return false;
      }

      const highestBid = await transaction.bid.findFirst({
        where: { lotId },
        orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        select: { userId: true, amount: true },
      });

      if (!highestBid) {
        if (lot.status === AuctionStatus.ENDED) {
          return false;
        }

        await transaction.lot.update({
          where: { id: lotId },
          data: { status: AuctionStatus.ENDED },
        });
        return true;
      }

      if (highestBid.userId === lot.sellerId) {
        throw new Error(`Auction ${lotId} has a bid from its own seller.`);
      }

      const walletUserIds = [highestBid.userId, lot.sellerId].sort();
      for (const userId of walletUserIds) {
        await transaction.$queryRaw`
          SELECT user_id FROM wallets WHERE user_id = ${userId} FOR UPDATE
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
      const winnerWallet = walletsByUserId.get(highestBid.userId);
      const sellerWallet = walletsByUserId.get(lot.sellerId);

      if (!winnerWallet || !sellerWallet) {
        throw new Error(`Auction ${lotId} is missing a participant wallet.`);
      }

      if (winnerWallet.reservedBalance.lt(highestBid.amount)) {
        throw new Error(
          `Auction ${lotId} has an inconsistent winning bid reserve.`,
        );
      }

      await transaction.wallet.update({
        where: { userId: highestBid.userId },
        data: {
          reservedBalance: { decrement: highestBid.amount },
        },
      });
      await transaction.wallet.update({
        where: { userId: lot.sellerId },
        data: {
          availableBalance: { increment: highestBid.amount },
        },
      });
      await transaction.lot.update({
        where: { id: lotId },
        data: { status: AuctionStatus.ENDED, winnerId: highestBid.userId },
      });

      return true;
    });
  }
}
