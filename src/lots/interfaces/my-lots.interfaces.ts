import type { LotResponseDto } from '../schemas/create-lots.schemas.js';

export interface MyLotsResponseDto {
  lots: LotResponseDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
