import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ApiCallPanel } from "@/components/api-call-panel"
import { CreateCampaignForm } from "@/components/create-campaign-form"
import { getSessionUser } from "@/lib/session"

export default async function NewCampaignPage() {
  const user = await getSessionUser()
  if (!user) redirect("/")

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        <CreateCampaignForm user={user} />
        <ApiCallPanel />
      </div>
    </AppShell>
  )
}
