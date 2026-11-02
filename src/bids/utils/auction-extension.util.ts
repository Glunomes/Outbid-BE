const LATE_BID_THRESHOLD_MS = 30_000;
const AUCTION_EXTENSION_MS = 2 * 60_000;

export const getExtendedAuctionEnd = (
  auctionEnd: Date,
  now: Date,
): Date | undefined => {
  if (auctionEnd.getTime() - now.getTime() >= LATE_BID_THRESHOLD_MS) {
    return undefined;
  }

  return new Date(auctionEnd.getTime() + AUCTION_EXTENSION_MS);
};
