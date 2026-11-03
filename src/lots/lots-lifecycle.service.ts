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

      const ended = await this.prismaService.lot.updateMany({
        where: {
          status: AuctionStatus.ACTIVE,
          auctionEnd: { lte: now },
        },
        data: { status: AuctionStatus.ENDED },
      });

      if (ended.count > 0) {
        this.logger.log(`Ended ${ended.count} expired auction(s).`);
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
}
