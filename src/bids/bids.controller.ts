import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator.js';
import { BidsService } from './bids.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  makeBidSchema,
  type MakeBidDto,
  type MakeBidResponseDto,
} from './schemas/make-bid.schemas.js';

@Controller('lots/:lotId/bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  makeBid(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body(new ZodValidationPipe(makeBidSchema)) dto: MakeBidDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MakeBidResponseDto> {
    return this.bidsService.makeBid(lotId, dto.amount, user.userId);
  }
}
