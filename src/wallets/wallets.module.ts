import { Module } from '@nestjs/common';
import { WalletsService } from './wallets.service.js';
import { WalletsController } from './wallets.controller.js';

@Module({
  providers: [WalletsService],
  controllers: [WalletsController],
})
export class WalletsModule {}
