import { getExtendedAuctionEnd } from './auction-extension.util.js';

describe('getExtendedAuctionEnd', () => {
  const auctionEnd = new Date('2026-11-02T16:30:00.000Z');

  it('does not extend when exactly 30 seconds remain', () => {
    const now = new Date(auctionEnd.getTime() - 30_000);

    expect(getExtendedAuctionEnd(auctionEnd, now)).toBeUndefined();
  });

  it('extends by two minutes when less than 30 seconds remain', () => {
    const now = new Date(auctionEnd.getTime() - 29_999);

    expect(getExtendedAuctionEnd(auctionEnd, now)).toEqual(
      new Date(auctionEnd.getTime() + 2 * 60_000),
    );
  });
});
