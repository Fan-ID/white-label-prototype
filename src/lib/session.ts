import "server-only"

import { cookies } from "next/headers"
import { SESSION_COOKIE } from "@/lib/config"
import { getUser, type PartnerUser } from "@/lib/db"

export async function getSessionUser(): Promise<PartnerUser | null> {
  const jar = await cookies()
  const id = jar.get(SESSION_COOKIE)?.value
  if (!id) return null
  return getUser(id)
}

export async function requireSessionUser(): Promise<PartnerUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error("No partner user selected")
  }
  return user
}
