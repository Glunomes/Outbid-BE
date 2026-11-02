import { Module } from '@nestjs/common';
import { BidsService } from './bids.service.js';
import { BidsController } from './bids.controller.js';

@Module({
  providers: [BidsService],
  controllers: [BidsController]
})
export class BidsModule {}
