import { NextResponse } from "next/server";
import { getCampaignMap, updateCampaignMapFields } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { soundlinkRequest } from "@/lib/soundlink-api";

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(_request: Request, { params }: Params) {
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

  const result = await soundlinkRequest("GET", `/v1/campaigns/${campaignId}`);
  let nextMapped = mapped;
  if (result.ok) {
    const status = extractStatus(result.data);
    const campaignUrl = extractCampaignUrl(result.data);
    if (status || campaignUrl) {
      await updateCampaignMapFields(campaignId, {
        ...(status ? { status } : {}),
        ...(campaignUrl ? { campaignUrl } : {}),
      });
      nextMapped = (await getCampaignMap(campaignId)) ?? mapped;
    }
  }

  // 200 with local map even if Soundlink fails, so creating poll continues.
  return NextResponse.json({
    mapped: nextMapped,
    api: result,
    ...(result.ok
      ? {}
      : {
          warning:
            "Soundlink API unavailable; showing local campaign_map status",
        }),
  });
}

function extractStatus(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as { data?: { status?: string }; status?: string };
  return root.data?.status || root.status || null;
}

function extractCampaignUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as {
    data?: { campaignUrl?: string };
    campaignUrl?: string;
  };
  const url = root.data?.campaignUrl || root.campaignUrl;
  return url?.trim() || null;
}
