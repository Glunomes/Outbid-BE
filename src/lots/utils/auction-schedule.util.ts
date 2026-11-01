const MAX_AUCTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type AuctionDate = string | null | undefined;
type AuctionDateField = 'auctionStart' | 'auctionEnd';
type AuctionScheduleValidationMode = 'create' | 'update';

type AuctionScheduleIssue = {
  path: AuctionDateField;
  message: string;
};

export function getAuctionScheduleIssues(
  auctionStart: AuctionDate,
  auctionEnd: AuctionDate,
  mode: AuctionScheduleValidationMode,
): AuctionScheduleIssue[] {
  const issues: AuctionScheduleIssue[] = [];
  const hasAuctionStart = auctionStart !== undefined;
  const hasAuctionEnd = auctionEnd !== undefined;

  if (mode === 'create' && hasAuctionStart !== hasAuctionEnd) {
    issues.push({
      path: hasAuctionStart ? 'auctionEnd' : 'auctionStart',
      message: hasAuctionStart
        ? 'Auction end time is required when start time is set.'
        : 'Auction start time is required when end time is set.',
    });
  }

  if (mode === 'update') {
    if (hasAuctionStart !== hasAuctionEnd) {
      issues.push({
        path: hasAuctionStart ? 'auctionEnd' : 'auctionStart',
        message: 'Auction start and end times must be updated together.',
      });
      return issues;
    }

    if (
      hasAuctionStart &&
      hasAuctionEnd &&
      (auctionStart === null) !== (auctionEnd === null)
    ) {
      issues.push({
        path: auctionStart === null ? 'auctionEnd' : 'auctionStart',
        message:
          'Auction start and end times must both be set or both be null.',
      });
      return issues;
    }
  }

  if (typeof auctionStart === 'string') {
    if (new Date(auctionStart).getTime() < Date.now()) {
      issues.push({
        path: 'auctionStart',
        message: 'Auction start time cannot be in the past.',
      });
    }
  }

  if (typeof auctionStart !== 'string' || typeof auctionEnd !== 'string') {
    return issues;
  }

  const auctionDurationMs =
    new Date(auctionEnd).getTime() - new Date(auctionStart).getTime();

  if (auctionDurationMs <= 0) {
    issues.push({
      path: 'auctionEnd',
      message: 'Auction end time must be after the start time.',
    });
  } else if (auctionDurationMs > MAX_AUCTION_DURATION_MS) {
    issues.push({
      path: 'auctionEnd',
      message: 'Auction duration cannot exceed 7 days.',
    });
  }

  return issues;
}
