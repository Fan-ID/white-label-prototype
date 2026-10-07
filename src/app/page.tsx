import { AppShell } from "@/components/app-shell"
import { UserPicker } from "@/components/user-picker"
import { isAdminUser } from "@/lib/config"
import { listUsers } from "@/lib/db"
import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"

export default async function Home() {
  const user = await getSessionUser()
  if (user) redirect(isAdminUser(user.id) ? "/admin" : "/campaigns")

  const users = await listUsers()

  return (
    <AppShell user={null}>
      <UserPicker users={users} />
    </AppShell>
  )
}
