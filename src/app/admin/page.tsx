import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { AdminCampaignMap } from "@/components/admin-campaign-map"
import { isAdminUser } from "@/lib/config"
import { listAllCampaignMaps, listUsers } from "@/lib/db"
import { getSessionUser } from "@/lib/session"

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user) redirect("/")
  if (!isAdminUser(user.id)) redirect("/campaigns")

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
