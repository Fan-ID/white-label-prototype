"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2, TrendingUp } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Overview = {
  listeners?: number
  streams?: number
  followers?: number
  impressions?: number
  ad_clicks?: number
  link_clicks?: number
  spend_media?: number
  spend_total?: number
  fees?: number
  currency?: string
  cpl?: number
  cpf?: number
  streams_per_listener?: number
}

type BreakdownRow = {
  report_date?: string
  country_code?: string
  streams?: number
  listeners?: number
  followers?: number
  spend_total?: number
  impressions?: number
  link_clicks?: number
}

function unwrapData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null
  const root = payload as { data?: T; ok?: boolean }
  if (root.data !== undefined) return root.data
  return payload as T
}

function money(n: number | undefined, currency = "USD") {
  if (n == null || Number.isNaN(n)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n)
}

function num(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "—"
  return new Intl.NumberFormat("en-US").format(n)
}

function ratio(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "—"
  return n.toFixed(2)
}

export function CampaignInsights({
  campaignId,
  enabled,
}: {
  campaignId: string
  enabled: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [rows, setRows] = useState<BreakdownRow[]>([])
  const [range, setRange] = useState<{ startDate: string; endDate: string } | null>(
    null,
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/metrics`)
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || "Failed to load metrics")
        }
        if (cancelled) return

        setRange(json.range ?? null)

        const overviewPayload = json.overview
        if (overviewPayload?.ok) {
          const data = unwrapData<Overview>(overviewPayload.data)
          setOverview(data)
        } else {
          setOverview(null)
        }

        const breakdownPayload = json.breakdown
        if (breakdownPayload?.ok) {
          const data = unwrapData<{ items?: BreakdownRow[] }>(
            breakdownPayload.data,
          )
          setRows(data?.items ?? [])
        } else {
          setRows([])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load metrics")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [campaignId, enabled])

  const byDay = useMemo(() => {
    const map = new Map<
      string,
      { date: string; spend: number; streams: number; listeners: number }
    >()
    for (const row of rows) {
      const date = row.report_date
      if (!date) continue
      const current = map.get(date) ?? {
        date,
        spend: 0,
        streams: 0,
        listeners: 0,
      }
      current.spend += Number(row.spend_total ?? 0)
      current.streams += Number(row.streams ?? 0)
      current.listeners += Number(row.listeners ?? 0)
      map.set(date, current)
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [rows])

  const byCountry = useMemo(() => {
    const map = new Map<
      string,
      { country: string; spend: number; streams: number; followers: number }
    >()
    for (const row of rows) {
      const country = row.country_code || "??"
      const current = map.get(country) ?? {
        country,
        spend: 0,
        streams: 0,
        followers: 0,
      }
      current.spend += Number(row.spend_total ?? 0)
      current.streams += Number(row.streams ?? 0)
      current.followers += Number(row.followers ?? 0)
      map.set(country, current)
    }
    return [...map.values()]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8)
  }, [rows])

  if (!enabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Metrics unlock when the campaign leaves <code>creating</code>.
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading overview + country breakdown…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    )
  }

  const currency = overview?.currency || "USD"
  const empty = !overview && rows.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="size-4 text-primary" />
            Performance
          </h2>
          <p className="text-xs text-muted-foreground">
            From Public API{" "}
            <code>metrics/overview</code> + <code>metrics/breakdown</code>
            {range ? ` · ${range.startDate} → ${range.endDate}` : ""}
          </p>
        </div>
      </div>

      {empty ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No metrics yet for this range. New campaigns often need a day of
            delivery before rows appear.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Spend total"
              value={money(overview?.spend_total, currency)}
              hint={`media ${money(overview?.spend_media, currency)} + fees ${money(overview?.fees, currency)}`}
            />
            <Kpi label="Listeners" value={num(overview?.listeners)} />
            <Kpi label="Streams" value={num(overview?.streams)} />
            <Kpi label="Followers" value={num(overview?.followers)} />
            <Kpi label="Impressions" value={num(overview?.impressions)} />
            <Kpi label="Link clicks" value={num(overview?.link_clicks)} />
            <Kpi label="CPL" value={money(overview?.cpl, currency)} />
            <Kpi
              label="Streams / listener"
              value={ratio(overview?.streams_per_listener)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Spend & streams by day</CardTitle>
                <CardDescription>
                  Aggregated from country-day breakdown rows
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64 pt-2">
                {byDay.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={byDay}>
                      <defs>
                        <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor="hsl(14 87% 56%)"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(14 87% 56%)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => String(v).slice(5)}
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={40} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid hsl(var(--border))",
                          fontSize: 12,
                        }}
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="spend"
                        name="Spend"
                        stroke="hsl(14 87% 56%)"
                        fill="url(#spendFill)"
                        strokeWidth={2}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="streams"
                        name="Streams"
                        stroke="hsl(162 85% 36%)"
                        fill="transparent"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top countries by spend</CardTitle>
                <CardDescription>Top 8 from breakdown</CardDescription>
              </CardHeader>
              <CardContent className="h-64 pt-2">
                {byCountry.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCountry} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="country"
                        width={36}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid hsl(var(--border))",
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="spend"
                        name="Spend"
                        fill="hsl(14 87% 56%)"
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Country breakdown</CardTitle>
              <CardDescription>
                First page of <code>metrics/breakdown</code> (up to 500 rows)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rows.</p>
              ) : (
                <div className="max-h-80 overflow-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                        <TableHead className="text-right">Streams</TableHead>
                        <TableHead className="text-right">Listeners</TableHead>
                        <TableHead className="text-right">Followers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 40).map((row, i) => (
                        <TableRow
                          key={`${row.report_date}-${row.country_code}-${i}`}
                        >
                          <TableCell className="font-mono text-xs">
                            {row.report_date}
                          </TableCell>
                          <TableCell>{row.country_code}</TableCell>
                          <TableCell className="text-right">
                            {money(row.spend_total, currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            {num(row.streams)}
                          </TableCell>
                          <TableCell className="text-right">
                            {num(row.listeners)}
                          </TableCell>
                          <TableCell className="text-right">
                            {num(row.followers)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No chart data yet
    </div>
  )
}
