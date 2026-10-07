"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, Square } from "lucide-react"
import {
  CAMPAIGN_POLL_INTERVAL_MS,
  shouldPollCampaignStatus,
} from "@/lib/campaign-status"
import { ApiCallPanel } from "@/components/api-call-panel"
import { CampaignInsights } from "@/components/campaign-insights"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<unknown>(null)
  const [mapped, setMapped] = useState<{
    campaignName: string
    status: string
    spotifyUrl: string
    dailyBudget: number
    durationDays: number
    genre: string
    strategyType: string
    creativeMode: string
    campaignUrl: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)
  const [polling, setPolling] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}`)
    const json = await res.json()
    if (json.mapped) {
      setMapped(json.mapped)
      setData(json.api)
      setError(
        typeof json.warning === "string"
          ? json.warning
          : res.ok
            ? null
            : json.error || null,
      )
      return json.mapped.status as string | undefined
    }
    if (!res.ok) {
      setError(json.error || "Failed to load")
      return null
    }
    setError(null)
    setData(json.api)
    return null
  }, [campaignId])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function tick() {
      const status = await load()
      if (cancelled) return
      if (shouldPollCampaignStatus(status)) {
        setPolling(true)
        timer = setTimeout(tick, CAMPAIGN_POLL_INTERVAL_MS)
      } else {
        setPolling(false)
      }
    }

    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [load])

  async function stop() {
    if (
      !confirm(
        "Stop this campaign? Unspent budget refunds to the org wallet.",
      )
    ) {
      return
    }
    setStopping(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/stop`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok) {
        setError(
          json.error ||
          json.api?.error ||
          "Failed to stop campaign on Soundlink",
        )
        return
      }
      setError(null)
      await load()
      setPolling(false)
    } finally {
      setStopping(false)
    }
  }

  const isCreating = shouldPollCampaignStatus(mapped?.status)
  const metricsEnabled = Boolean(mapped && !isCreating)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/campaigns">
          <ArrowLeft className="size-3.5" />
          Back to campaigns
        </Link>
      </Button>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {mapped && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <CardTitle className="truncate">{mapped.campaignName}</CardTitle>
              <CardDescription className="mt-1 font-mono text-xs">
                {campaignId}
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className={isCreating ? "gap-1.5 shrink-0" : "shrink-0"}
            >
              {isCreating && <Loader2 className="size-3 animate-spin" />}
              {mapped.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {polling && isCreating && (
              <p className="rounded-lg bg-accent/70 px-3 py-2 text-xs text-accent-foreground">
                Polling <code>GET /v1/campaigns/{campaignId}</code> every{" "}
                {CAMPAIGN_POLL_INTERVAL_MS / 1000}s until status leaves{" "}
                <code>creating</code>…
              </p>
            )}
            <p className="truncate text-sm text-muted-foreground">
              {mapped.spotifyUrl}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                ${mapped.dailyBudget}/day × {mapped.durationDays}d
              </span>
              <span>· {mapped.genre}</span>
              <span>· {mapped.strategyType}</span>
              <span>· {mapped.creativeMode}</span>
            </div>
            {mapped.campaignUrl && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={mapped.campaignUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-3.5" />
                  Open in Soundlink
                </a>
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={stop}
              disabled={
                stopping ||
                mapped.status === "stopped" ||
                mapped.status === "ended" ||
                mapped.status === "completed" ||
                mapped.status === "creating"
              }
            >
              <Square className="size-3.5" />
              {stopping
                ? "Stopping…"
                : mapped.status === "creating"
                  ? "Wait until active to stop"
                  : "Stop campaign"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>
        <TabsContent value="insights" className="mt-4">
          <CampaignInsights
            campaignId={campaignId}
            enabled={metricsEnabled}
          />
        </TabsContent>
        <TabsContent value="api" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign payload</CardTitle>
              <CardDescription>
                <code>GET /v1/campaigns/:id</code>
                {polling ? " · auto-refreshing" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-[11px]">
                {JSON.stringify(data, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <ApiCallPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
