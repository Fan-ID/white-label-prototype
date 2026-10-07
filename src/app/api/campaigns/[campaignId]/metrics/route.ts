import { NextResponse } from "next/server";
import { getCampaignMap } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { soundlinkRequest } from "@/lib/soundlink-api";

type Params = { params: Promise<{ campaignId: string }> };

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - 30);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: toIso(start), endDate: toIso(end) };
}

export async function GET(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Select a Groover artist first" },
      { status: 401 },
    );
  }

  const { campaignId } = await params;
  const mapped = await getCampaignMap(campaignId);
  if (!mapped || mapped.partnerUserId !== user.id) {
    return NextResponse.json(
      { error: "Campaign not found for this artist" },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const defaults = defaultDateRange();
  const startDate = url.searchParams.get("startDate") || defaults.startDate;
  const endDate = url.searchParams.get("endDate") || defaults.endDate;
  const qs = `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  const [overview, breakdown] = await Promise.all([
    soundlinkRequest(
      "GET",
      `/v1/campaigns/${campaignId}/metrics/overview?${qs}`,
    ),
    soundlinkRequest(
      "GET",
      `/v1/campaigns/${campaignId}/metrics/breakdown?${qs}&page=1&pageSize=500&sortBy=report_date&sortOrder=asc`,
    ),
  ]);

  return NextResponse.json({
    range: { startDate, endDate },
    overview,
    breakdown,
  });
}
