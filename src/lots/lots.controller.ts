import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Get,
  Query,
  Post,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
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
  type LotResponseDto,
} from './schemas/create-lots.schemas.js';
import {
  updateLotSchema,
  type UpdateLotDto,
  type UpdateLotResponseDto,
} from './schemas/update-lots.schemas.js';
import {
  lotsCatalogQuerySchema,
  type LotsCatalogQueryDto,
} from './schemas/lots-catalog.schemas.js';
import type { LotsCatalogResponseDto } from './interfaces/lots-catalog.interfaces.js';

@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createLot(
    @Body(new ZodValidationPipe(createLotSchema)) dto: CreateLotDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LotResponseDto> {
    return this.lotsService.createLot(dto, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  updateLot(
    @Body(new ZodValidationPipe(updateLotSchema)) dto: UpdateLotDto,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UpdateLotResponseDto> {
    return this.lotsService.updateLot(id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  cancelLot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ lotId: string; cancelled: true }> {
    return this.lotsService.cancelLot(id, user.userId);
  }

  @Get(':id')
  getLot(@Param('id', ParseUUIDPipe) id: string): Promise<LotResponseDto> {
    return this.lotsService.getLot(id);
  }

  @Get()
  getLots(
    @Query(new ZodValidationPipe(lotsCatalogQuerySchema))
    query: LotsCatalogQueryDto,
  ): Promise<LotsCatalogResponseDto> {
    return this.lotsService.getLots(query);
  }
}
