import { Module } from '@nestjs/common';
import { LotsService } from './lots.service.js';
import { LotsController } from './lots.controller.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { LotsLifecycleService } from './lots-lifecycle.service.js';

@Module({
  providers: [LotsService, JwtAuthGuard, LotsLifecycleService],
  controllers: [LotsController],
})
export class LotsModule {}
