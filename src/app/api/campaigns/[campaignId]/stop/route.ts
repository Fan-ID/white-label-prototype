import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getCampaignMap, updateCampaignStatus } from "@/lib/db"
import { getSessionUser } from "@/lib/session"
import { soundlinkRequest } from "@/lib/soundlink-api"

type Params = { params: Promise<{ campaignId: string }> }

export async function POST(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Select a Groover artist first" }, { status: 401 })
  }
  const { campaignId } = await params
  const mapped = await getCampaignMap(campaignId)
  if (!mapped || mapped.partnerUserId !== user.id) {
    return NextResponse.json({ error: "Campaign not found for this artist" }, { status: 404 })
  }

  const result = await soundlinkRequest(
    "POST",
    `/v1/campaigns/${campaignId}/stop`,
    {},
    randomUUID(),
  )

  if (result.ok) {
    await updateCampaignStatus(campaignId, "stopped")
  }

  return NextResponse.json({ api: result }, { status: result.ok ? 200 : 502 })
}
