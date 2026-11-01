import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { LotsService } from './lots.service.js';
import {
  createLotSchema,
  type CreateLotDto,
  type CreateLotResponseDto,
} from './schemas/create-lots.schemas.js';

@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createLot(
    @Body(new ZodValidationPipe(createLotSchema)) dto: CreateLotDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateLotResponseDto> {
    return this.lotsService.createLot(dto, user.userId);
  }
}
