export const POLLING_CAMPAIGN_STATUSES = new Set(["creating"]);

export function shouldPollCampaignStatus(status: string | null | undefined) {
  if (!status) return false;
  return POLLING_CAMPAIGN_STATUSES.has(status);
}

export const CAMPAIGN_POLL_INTERVAL_MS = 3000;
