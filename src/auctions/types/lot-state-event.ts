import type { AuctionStatus } from '../../generated/prisma/enums.js';

export type LotStateEvent = {
  lot: {
    id: string;
    name: string;
    description: string | null;
    startingPrice: string;
    currentPrice: string | null;
    auctionStart: string | null;
    auctionEnd: string | null;
    status: AuctionStatus;
    createdAt: string;
    updatedAt: string;
    seller: { name: string };
  };
  bids: {
    amount: string;
    createdAt: string;
  }[];
};
