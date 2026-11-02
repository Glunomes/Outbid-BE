import { AuctionStatus } from '../../generated/prisma/enums.js';

export interface LotsCatalogOptions {
  page?: number;
  limit?: number;
  name?: string;
  status?: AuctionStatus;
  auctionStartFrom?: string;
  auctionStartTo?: string;
}

export interface LotCatalogItemDto {
  id: string;
  name: string;
  description: string | null;
  price: string;
  auctionStart: string | null;
  auctionEnd: string | null;
  status: AuctionStatus;
}

export interface LotsCatalogResponseDto {
  lots: LotCatalogItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
