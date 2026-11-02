import { Module } from '@nestjs/common';
import { BidsService } from './bids.service.js';
import { BidsController } from './bids.controller.js';
import { BidsGateway } from './bids.gateway.js';

@Module({
  providers: [BidsService, BidsGateway],
  controllers: [BidsController],
})
export class BidsModule {}
