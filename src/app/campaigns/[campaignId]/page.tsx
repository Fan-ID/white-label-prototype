import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { CampaignDetail } from "@/components/campaign-detail"
import { getSessionUser } from "@/lib/session"

type Props = { params: Promise<{ campaignId: string }> }

export default async function CampaignDetailPage({ params }: Props) {
  const user = await getSessionUser()
  if (!user) redirect("/")
  const { campaignId } = await params

  return (
    <AppShell user={user}>
      <CampaignDetail campaignId={campaignId} />
    </AppShell>
  )
}
