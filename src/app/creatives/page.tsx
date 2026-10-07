import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ApiCallPanel } from "@/components/api-call-panel"
import { CreativesManager } from "@/components/creatives-manager"
import { getSessionUser } from "@/lib/session"

export default async function CreativesPage() {
  const user = await getSessionUser()
  if (!user) redirect("/")

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Creatives</h1>
        <p className="text-sm text-muted-foreground">
          Import videos into the Soundlink org library, then use them in
          full_control campaigns.
        </p>
      </div>
      <div className="space-y-8">
        <CreativesManager />
        <ApiCallPanel />
      </div>
    </AppShell>
  )
}
