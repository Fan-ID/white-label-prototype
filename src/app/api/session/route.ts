import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE } from "@/lib/config"
import { getUser, listUsers } from "@/lib/db"

export async function GET() {
  const users = await listUsers()
  const jar = await cookies()
  const currentId = jar.get(SESSION_COOKIE)?.value ?? null
  const current = currentId ? await getUser(currentId) : null
  return NextResponse.json({ users, current })
}

export async function POST(request: Request) {
  const body = (await request.json()) as { userId?: string }
  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }
  const user = await getUser(body.userId)
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  const jar = await cookies()
  jar.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return NextResponse.json({ ok: true, user })
}

export async function DELETE() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}
