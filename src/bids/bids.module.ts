import { Module } from '@nestjs/common';
import { BidsService } from './bids.service.js';
import { BidsController } from './bids.controller.js';
import { AuctionRealtimeModule } from '../auctions/auction-realtime.module.js';

@Module({
  imports: [AuctionRealtimeModule],
  providers: [BidsService],
  controllers: [BidsController],
})
export class BidsModule {}
