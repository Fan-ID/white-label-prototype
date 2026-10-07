"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Database, Search, Target } from "lucide-react"
import type { CampaignMapAdminRow, PartnerUser } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL_ARTISTS = "__all__"
const ALL_STATUSES = "__all__"

function usd(n: number) {
  return `$${n.toFixed(2)}`
}

export function AdminCampaignMap({
  rows,
  users,
}: {
  rows: CampaignMapAdminRow[]
  users: PartnerUser[]
}) {
  const [artistId, setArtistId] = useState(ALL_ARTISTS)
  const [status, setStatus] = useState(ALL_STATUSES)
  const [query, setQuery] = useState("")

  const statuses = useMemo(() => {
    const set = new Set(rows.map((r) => r.status))
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (artistId !== ALL_ARTISTS && row.partnerUserId !== artistId) {
        return false
      }
      if (status !== ALL_STATUSES && row.status !== status) return false
      if (!q) return true
      return (
        row.campaignName.toLowerCase().includes(q) ||
        row.campaignId.toLowerCase().includes(q) ||
        row.partnerUserId.toLowerCase().includes(q) ||
        row.partnerUserName.toLowerCase().includes(q) ||
        row.partnerUserHandle.toLowerCase().includes(q) ||
        row.genre.toLowerCase().includes(q) ||
        row.spotifyUrl.toLowerCase().includes(q) ||
        row.idempotencyKey.toLowerCase().includes(q)
      )
    })
  }, [rows, artistId, status, query])

  const spendTotals = useMemo(() => {
    const soundlink = filtered.reduce((sum, r) => sum + r.soundlinkSpend, 0)
    const partner = filtered.reduce((sum, r) => sum + r.partnerFee, 0)
    return { soundlink, partner, grand: soundlink + partner }
  }, [filtered])

  const spendByArtist = useMemo(() => {
    const map = new Map<
      string,
      {
        partnerUserId: string
        name: string
        handle: string
        soundlinkSpend: number
        partnerFee: number
        campaigns: number
      }
    >()
    for (const row of filtered) {
      const current = map.get(row.partnerUserId)
      if (current) {
        current.soundlinkSpend += row.soundlinkSpend
        current.partnerFee += row.partnerFee
        current.campaigns += 1
      } else {
        map.set(row.partnerUserId, {
          partnerUserId: row.partnerUserId,
          name: row.partnerUserName,
          handle: row.partnerUserHandle,
          soundlinkSpend: row.soundlinkSpend,
          partnerFee: row.partnerFee,
          campaigns: 1,
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.soundlinkSpend + b.partnerFee - (a.soundlinkSpend + a.partnerFee),
    )
  }, [filtered])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Database className="size-6 text-muted-foreground" />
          Admin · campaign_map
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Local partner DB mapping (all artists). Not filtered by session.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Soundlink (filtered)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {usd(spendTotals.soundlink)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>White-label fee (filtered)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {usd(spendTotals.partner)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total (filtered)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {usd(spendTotals.grand)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Spend by artist</CardTitle>
          <CardDescription>
            Soundlink cycle cost at create · white-label fee reserved (always $0
            for now)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {spendByArtist.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No spend for the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artist</TableHead>
                    <TableHead className="text-right">Campaigns</TableHead>
                    <TableHead className="text-right">Soundlink</TableHead>
                    <TableHead className="text-right">White-label</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spendByArtist.map((row) => (
                    <TableRow key={row.partnerUserId}>
                      <TableCell>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          @{row.handle}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.campaigns}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {usd(row.soundlinkSpend)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {usd(row.partnerFee)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {usd(row.soundlinkSpend + row.partnerFee)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            {filtered.length} of {rows.length} rows
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, id, artist, genre…"
              className="pl-8"
            />
          </div>
          <Select value={artistId} onValueChange={setArtistId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Artist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ARTISTS}>All artists</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No rows match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artist</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Soundlink ID</TableHead>
                    <TableHead>Our ID</TableHead>
                    <TableHead className="w-10" />
                    <TableHead>Status</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead className="text-right">Soundlink</TableHead>
                    <TableHead className="text-right">White-label</TableHead>
                    <TableHead>Genre</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.campaignId}>
                      <TableCell>
                        <div className="min-w-[8rem]">
                          <p className="font-medium">{row.partnerUserName}</p>
                          <p className="text-xs text-muted-foreground">
                            @{row.partnerUserHandle}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/campaigns/${row.campaignId}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {row.campaignName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p
                          className="max-w-[12rem] truncate font-mono text-[11px]"
                          title={row.campaignId}
                        >
                          {row.campaignId}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p
                          className="max-w-[12rem] truncate font-mono text-[11px]"
                          title={row.partnerUserId}
                        >
                          {row.partnerUserId}
                        </p>
                      </TableCell>
                      <TableCell>
                        {row.campaignUrl ? (
                          <a
                            href={row.campaignUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in Soundlink dashboard"
                            aria-label="Open in Soundlink dashboard"
                            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Target className="size-4" />
                          </a>
                        ) : (
                          <span className="inline-block size-8" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.status}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        ${row.dailyBudget}/d × {row.durationDays}d
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {usd(row.soundlinkSpend)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {usd(row.partnerFee)}
                      </TableCell>
                      <TableCell className="text-sm">{row.genre}</TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          <p>{row.creativeMode}</p>
                          <p>{row.strategyType}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
