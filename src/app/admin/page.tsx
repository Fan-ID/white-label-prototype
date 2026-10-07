import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { AdminCampaignMap } from "@/components/admin-campaign-map"
import { listAllCampaignMaps, listUsers } from "@/lib/db"
import { getSessionUser } from "@/lib/session"

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user) redirect("/")

  const [rows, users] = await Promise.all([
    listAllCampaignMaps(),
    listUsers(),
  ])

  return (
    <AppShell user={user}>
      <AdminCampaignMap rows={rows} users={users} />
    </AppShell>
  )
}
