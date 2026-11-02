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
    await this.activateDueLots();
    this.interval = setInterval(
      () => void this.activateDueLots(),
      LIFECYCLE_CHECK_INTERVAL_MS,
    );
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async activateDueLots(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const { count } = await this.prismaService.lot.updateMany({
        where: {
          status: AuctionStatus.SCHEDULED,
          auctionStart: { lte: new Date() },
        },
        data: { status: AuctionStatus.ACTIVE },
      });

      if (count > 0) {
        this.logger.log(`Activated ${count} scheduled auction(s).`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to activate scheduled auctions.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
