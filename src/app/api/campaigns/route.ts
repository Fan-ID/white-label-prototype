import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isAdminUser } from "@/lib/config";
import { getSessionUser, requireSessionUser } from "@/lib/session";
import { insertCampaignMap, listCampaignsForUser } from "@/lib/db";
import { cycleCostUsd } from "@/lib/money";
import { assertCanCreateCampaign } from "@/lib/spend-guard";
import { soundlinkRequest } from "@/lib/soundlink-api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Select a Groover artist first" },
      { status: 401 },
    );
  }
  const campaigns = await listCampaignsForUser(user.id);
  return NextResponse.json({ campaigns, user });
}

type CreateBody = {
  spotifyUrl?: string;
  dailyBudget?: number;
  durationDays?: number;
  genre?: string;
  strategyType?: string;
  campaignName?: string;
  creativeDirection?:
    | { type: "do_it_for_me" }
    | { type: "full_control"; selectedCreatives: { videoId: string }[] };
  tierTargeting?: {
    customTiers?: {
      name: string;
      countries?: string[];
      language?: string;
      percentBudget: number;
    }[];
  };
};

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (isAdminUser(user.id)) {
      return NextResponse.json(
        { error: "Admin persona cannot create campaigns" },
        { status: 403 },
      );
    }
    const body = (await request.json()) as CreateBody;

    const spotifyUrl = body.spotifyUrl?.trim();
    const dailyBudget = Number(body.dailyBudget);
    const durationDays = Number(body.durationDays);
    const genre = body.genre;
    const strategyType = body.strategyType ?? "maximum_growth";

    if (!spotifyUrl || !genre) {
      return NextResponse.json(
        { error: "spotifyUrl and genre are required" },
        { status: 400 },
      );
    }

    const guard = await assertCanCreateCampaign({ dailyBudget, durationDays });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.reason }, { status: 400 });
    }

    const shortName =
      body.campaignName?.trim() ||
      `${user.handle}_${new Date().toISOString().slice(0, 10)}`;
    const campaignName = shortName.startsWith(`${user.handle}_`)
      ? shortName
      : `${user.handle}_${shortName}`;

    const idempotencyKey = randomUUID();
    const requestBody: Record<string, unknown> = {
      spotifyUrl,
      dailyBudget,
      durationDays,
      genre,
      strategyType,
      campaignName,
      creativeDirection: body.creativeDirection ?? { type: "do_it_for_me" },
    };
    if (strategyType === "custom" && body.tierTargeting) {
      requestBody.tierTargeting = body.tierTargeting;
    }

    const result = await soundlinkRequest<{
      data?: {
        id?: string;
        campaignId?: string;
        status?: string;
        campaignUrl?: string;
      };
    }>("POST", "/v1/campaigns", requestBody, idempotencyKey);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "Soundlink API rejected campaign create",
          cycleCostUsd: cycleCostUsd(dailyBudget, durationDays),
          api: result,
        },
        { status: 502 },
      );
    }

    const payload = result.data as {
      data?: {
        id?: string;
        campaignId?: string;
        status?: string;
        campaignUrl?: string;
      };
    };
    const campaignId = payload?.data?.campaignId || payload?.data?.id;
    if (!campaignId) {
      return NextResponse.json(
        {
          error:
            "Soundlink create succeeded but response had no campaignId — check API payload / wallet",
          api: result,
        },
        { status: 502 },
      );
    }
    const status = payload?.data?.status || "creating";
    const campaignUrl = payload?.data?.campaignUrl?.trim() || null;
    const creativeMode =
      body.creativeDirection?.type === "full_control"
        ? "full_control"
        : "do_it_for_me";
    const soundlinkSpend = cycleCostUsd(dailyBudget, durationDays);
    const partnerFee = 0;

    try {
      await insertCampaignMap({
        campaignId,
        partnerUserId: user.id,
        campaignName,
        spotifyUrl,
        dailyBudget,
        durationDays,
        genre,
        strategyType,
        creativeMode,
        idempotencyKey,
        status,
        campaignUrl,
        soundlinkSpend,
        partnerFee,
      });
    } catch (dbError) {
      return NextResponse.json(
        {
          error:
            "Campaign created on Soundlink but failed to save local campaign_map. Use campaignId to recover (Admin / Soundlink dashboard).",
          campaignId,
          campaignName,
          campaignUrl,
          status,
          cycleCostUsd: soundlinkSpend,
          api: result,
          dbError:
            dbError instanceof Error ? dbError.message : "Unknown DB error",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      campaignId,
      campaignName,
      cycleCostUsd: soundlinkSpend,
      soundlinkSpend,
      partnerFee,
      api: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "No partner user selected" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
