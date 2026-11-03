import { Module } from '@nestjs/common';
import { AuctionRealtimeGateway } from './auction-realtime.gateway.js';

@Module({
  providers: [AuctionRealtimeGateway],
  exports: [AuctionRealtimeGateway],
})
export class AuctionRealtimeModule {}
