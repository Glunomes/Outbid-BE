import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { LotsModule } from './lots/lots.module.js';
import { WalletsModule } from './wallets/wallets.module.js';
import { BidsModule } from './bids/bids.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    LotsModule,
    WalletsModule,
    BidsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
