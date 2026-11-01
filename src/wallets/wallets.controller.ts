import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  walletDepositSchema,
  type WalletDepositDto,
  type WalletResponseDto,
} from './schemas/wallet.schemas.js';
import { WalletsService } from './wallets.service.js';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getWallet(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WalletResponseDto> {
    return this.walletsService.getWallet(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/deposit')
  deposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(walletDepositSchema)) dto: WalletDepositDto,
  ): Promise<WalletResponseDto> {
    return this.walletsService.deposit(dto.amount, user.userId);
  }
}
