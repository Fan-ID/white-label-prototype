"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ChevronRight,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react"
import {
  CAMPAIGN_POLL_INTERVAL_MS,
  shouldPollCampaignStatus,
} from "@/lib/campaign-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { CampaignMapRow } from "@/lib/db"
import type { PartnerUser } from "@/lib/db"

function statusBadgeClass(status: string) {
  const s = status.toLowerCase()
  if (s === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }
  if (s === "creating") {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }
  if (s === "failed") {
    return "border-red-200 bg-red-50 text-red-800"
  }
  if (s === "paused") {
    return "border-sky-200 bg-sky-50 text-sky-900"
  }
  return "border-border bg-secondary text-secondary-foreground"
}

function spotifyLabel(url: string) {
  if (url.includes("/track/")) return "Spotify track"
  if (url.includes("/playlist/")) return "Spotify playlist"
  if (url.includes("/album/")) return "Spotify album"
  return "Spotify link"
}

function shortId(id: string) {
  if (id.length <= 14) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/70 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  )
}

export function CampaignsList({ user }: { user: PartnerUser }) {
  const [campaigns, setCampaigns] = useState<CampaignMapRow[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true)
    try {
      const res = await fetch("/api/campaigns")
      const json = await res.json()
      setCampaigns(json.campaigns ?? [])
      return (json.campaigns ?? []) as CampaignMapRow[]
    } finally {
      if (!opts?.quiet) setLoading(false)
    }
  }, [])

  /** Refresh status for transitional campaigns only (no full list fan-out). */
  const refreshPending = useCallback(async (rows: CampaignMapRow[]) => {
    const pending = rows.filter((c) => shouldPollCampaignStatus(c.status))
    if (pending.length === 0) return rows
    await Promise.all(
      pending.map((c) => fetch(`/api/campaigns/${c.campaignId}`)),
    )
    const res = await fetch("/api/campaigns")
    const json = await res.json()
    const next = (json.campaigns ?? []) as CampaignMapRow[]
    setCampaigns(next)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function tick(initial = false) {
      const rows = initial
        ? await load()
        : await load({ quiet: true }).then((r) => refreshPending(r ?? []))

      if (cancelled) return
      const list = rows ?? []
      const hasPending = list.some((c) => shouldPollCampaignStatus(c.status))
      setPolling(hasPending)
      if (hasPending) {
        timer = setTimeout(() => void tick(false), CAMPAIGN_POLL_INTERVAL_MS)
      }
    }

    void tick(true)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [load, refreshPending])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.name}&apos;s campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Mapped locally to @{user.handle} · created via Soundlink Public API
            {polling ? " · polling creating…" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link href="/campaigns/new">
              <Plus className="size-3.5" />
              Launch ads
            </Link>
          </Button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <Megaphone className="size-6" />
            </div>
            <div>
              <p className="font-medium">No campaigns yet</p>
              <p className="text-sm text-muted-foreground">
                Create one with a Spotify link — spends real wallet credits on
                your test org.
              </p>
            </div>
            <Button asChild>
              <Link href="/campaigns/new">Launch first campaign</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => {
            const pending = shouldPollCampaignStatus(c.status)
            const total = c.dailyBudget * c.durationDays
            return (
              <Card
                key={c.campaignId}
                className="group relative overflow-hidden border-border/80 transition hover:border-primary/35 hover:shadow-md"
              >
                <Link
                  href={`/campaigns/${c.campaignId}`}
                  className="absolute inset-0 z-0"
                  aria-label={`Open ${c.campaignName}`}
                />
                <div className="relative z-10 pointer-events-none">
                  <CardContent className="min-w-0 space-y-4 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
                            {c.campaignName}
                          </h2>
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize",
                              pending && "gap-1.5",
                              statusBadgeClass(c.status),
                            )}
                          >
                            {pending && (
                              <Loader2 className="size-3 animate-spin" />
                            )}
                            {c.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-[#1DB954]" />
                            {spotifyLabel(c.spotifyUrl)}
                          </span>
                          <span className="hidden text-border sm:inline">·</span>
                          <span
                            className="font-mono text-xs"
                            title={c.campaignId}
                          >
                            {shortId(c.campaignId)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {c.campaignUrl && (
                          <a
                            href={c.campaignUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in Soundlink dashboard"
                            aria-label="Open in Soundlink dashboard"
                            className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                          >
                            <Target className="size-4" />
                          </a>
                        )}
                        <ChevronRight className="size-5 text-muted-foreground/70 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Stat label="Daily" value={`$${c.dailyBudget}/day`} />
                      <Stat
                        label="Cycle"
                        value={`$${total.toFixed(0)} · ${c.durationDays}d`}
                      />
                      <Stat label="Genre" value={c.genre} />
                      <Stat
                        label="Setup"
                        value={`${c.strategyType.replaceAll("_", " ")} · ${c.creativeMode.replaceAll("_", " ")}`}
                      />
                    </div>
                  </CardContent>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
