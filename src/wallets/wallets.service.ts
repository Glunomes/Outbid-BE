import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { WalletResponseDto } from './schemas/wallet.schemas.js';

@Injectable()
export class WalletsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getWallet(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
      select: {
        availableBalance: true,
        reservedBalance: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      availableBalance: wallet.availableBalance.toFixed(2),
      reservedBalance: wallet.reservedBalance.toFixed(2),
    };
  }

  async deposit(amount: string, userId: string): Promise<WalletResponseDto> {
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount)) {
      throw new BadRequestException(
        'Deposit amount must be a positive number with up to 2 decimal places.',
      );
    }

    const depositAmount = new Prisma.Decimal(amount);
    if (depositAmount.lte(0)) {
      throw new BadRequestException(
        'Deposit amount must be greater than zero.',
      );
    }

    const existingWallet = await this.prismaService.wallet.findUnique({
      where: { userId },
      select: { userId: true },
    });

    if (!existingWallet) {
      throw new NotFoundException('Wallet not found');
    }

    const wallet = await this.prismaService.wallet.update({
      where: { userId },
      data: {
        availableBalance: { increment: depositAmount },
      },
      select: {
        availableBalance: true,
        reservedBalance: true,
      },
    });

    return {
      availableBalance: wallet.availableBalance.toFixed(2),
      reservedBalance: wallet.reservedBalance.toFixed(2),
    };
  }
}
