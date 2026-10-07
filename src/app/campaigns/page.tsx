import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ApiCallPanel } from "@/components/api-call-panel"
import { CampaignsList } from "@/components/campaigns-list"
import { getSessionUser } from "@/lib/session"

export default async function CampaignsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/")

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        <CampaignsList user={user} />
        <ApiCallPanel />
      </div>
    </AppShell>
  )
}
