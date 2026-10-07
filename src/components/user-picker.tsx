"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Music2, Sparkles } from "lucide-react"
import { isAdminUser } from "@/lib/config"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PartnerUser } from "@/lib/db"

export function UserPicker({ users }: { users: PartnerUser[] }) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function selectUser(userId: string) {
    setLoadingId(userId)
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      router.push(isAdminUser(userId) ? "/admin" : "/campaigns")
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card px-6 py-10 shadow-sm sm:px-10">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-20 left-10 size-48 rounded-full bg-soundlink/10 blur-3xl" />
        <div className="relative max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Sparkles className="size-3.5" />
            White-label prototype
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Launch Meta ads from Groover
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Pick a fake Groover artist. Campaigns are created on Soundlink via
            the Public API under one partner org — mapped per artist on our side.
          </p>
        </div>
      </section>

      <div>
        <h2 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Who&apos;s launching ads?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {users.map((user) => {
            const isLoading = loadingId === user.id
            const isBlocked = loadingId !== null && !isLoading
            const admin = isAdminUser(user.id)

            return (
              <Card
                key={user.id}
                className={cn(
                  "group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md",
                  isBlocked && "pointer-events-none opacity-50",
                  isLoading && "ring-2 ring-primary/40",
                  admin && "border-dashed",
                )}
              >
                <CardHeader className="pb-3">
                  <div
                    className="mb-3 flex size-12 items-center justify-center rounded-2xl text-lg font-semibold text-white shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, hsl(${user.avatarHue} 85% 55%), hsl(${user.avatarHue + 30} 80% 45%))`,
                    }}
                  >
                    {user.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </div>
                  <CardTitle className="text-lg">{user.name}</CardTitle>
                  <CardDescription>
                    {admin ? "Staff · campaign map only" : `@${user.handle}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Music2 className="size-4 text-primary" />
                    {admin ? "No campaign create" : user.genre}
                  </div>
                  <Button
                    onClick={() => selectUser(user.id)}
                    disabled={isLoading}
                    className="w-full"
                    variant={admin ? "outline" : "default"}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Entering…
                      </>
                    ) : admin ? (
                      "Open admin"
                    ) : (
                      "Continue as artist"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
