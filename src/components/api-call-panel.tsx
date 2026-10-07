"use client"

import { useEffect, useState } from "react"
import { Activity, ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Call = {
  id: number
  method: string
  path: string
  status: number
  durationMs: number
  requestBody: unknown
  responseBody: unknown
  createdAt: string
}

export function ApiCallPanel() {
  const [calls, setCalls] = useState<Call[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/calls")
      const json = await res.json()
      setCalls(json.calls ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-soundlink" />
            Public API calls
          </CardTitle>
          <CardDescription>
            Exact requests this prototype makes to Soundlink — what Groover would
            integrate.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No calls yet. Create a campaign or import a video to see traffic.
          </p>
        ) : (
          calls.map((call) => {
            const open = openId === call.id
            const ok = call.status >= 200 && call.status < 300
            return (
              <div
                key={call.id}
                className="rounded-xl border border-border/70 bg-muted/30"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
                  onClick={() => setOpenId(open ? null : call.id)}
                >
                  {open ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <Badge variant={ok ? "secondary" : "destructive"}>
                    {call.status}
                  </Badge>
                  <span className="font-mono text-xs font-semibold">
                    {call.method}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {call.path}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {call.durationMs}ms
                  </span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-border/60 px-3 py-3">
                    <pre className="overflow-x-auto rounded-lg bg-background p-3 text-[11px]">
                      {JSON.stringify(
                        {
                          request: call.requestBody,
                          response: call.responseBody,
                          at: call.createdAt,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
