"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Clapperboard,
  DollarSign,
  Globe2,
  Link2,
  Sparkles,
} from "lucide-react"
import { PUBLIC_API_GENRES, SPEND_GUARD } from "@/lib/config"
import { cycleCostUsd } from "@/lib/money"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FullControlCreativesPicker,
  resolveCreativeVideoIds,
  type CreativePick,
} from "@/components/full-control-creatives-picker"
import type { PartnerUser } from "@/lib/db"

// Genre is required for both creative modes (product UI + Public API).
const STEPS = ["Track", "Creative", "Genre", "Budget", "Review"] as const

export function CreateCampaignForm({ user }: { user: PartnerUser }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [spotifyUrl, setSpotifyUrl] = useState("")
  const [genre, setGenre] = useState<string>(user.genre)
  const [strategyType, setStrategyType] = useState("maximum_growth")
  const [dailyBudget, setDailyBudget] = useState<number>(
    SPEND_GUARD.maxDailyBudgetUsd,
  )
  const [durationDays, setDurationDays] = useState<number>(
    SPEND_GUARD.maxDurationDays,
  )
  const [campaignName, setCampaignName] = useState("")
  const [creativeMode, setCreativeMode] = useState<
    "do_it_for_me" | "full_control"
  >("do_it_for_me")
  const [selectedCreatives, setSelectedCreatives] = useState<CreativePick[]>(
    [],
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = cycleCostUsd(dailyBudget, durationDays)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      if (creativeMode === "full_control" && selectedCreatives.length === 0) {
        setError("Select at least one creative for full_control.")
        setStep(1)
        return
      }
      if (!genre) {
        setError("Genre is required (both creative modes).")
        setStep(2)
        return
      }

      let creativeDirection:
        | { type: "do_it_for_me" }
        | {
          type: "full_control"
          selectedCreatives: { videoId: string }[]
        } = { type: "do_it_for_me" }

      if (creativeMode === "full_control") {
        const videoIds = await resolveCreativeVideoIds(selectedCreatives)
        creativeDirection = {
          type: "full_control",
          selectedCreatives: videoIds.map((videoId) => ({ videoId })),
        }
      }

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyUrl,
          dailyBudget,
          durationDays,
          genre,
          strategyType,
          campaignName: campaignName || undefined,
          creativeDirection,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.campaignId) {
          setError(
            `${json.error || "Create partially failed"} · Soundlink id: ${json.campaignId}`,
          )
          return
        }
        setError(json.error || "Create failed")
        return
      }
      router.push(`/campaigns/${json.campaignId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Launch Meta ads for {user.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Same order as Soundlink Paid Growth · Public API create
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${i === step
              ? "bg-primary text-primary-foreground"
              : i < step
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground"
              }`}
          >
            {i < step ? <Check className="size-3" /> : <span>{i + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="size-4 text-primary" />
              Select your music
            </CardTitle>
            <CardDescription>
              Track or playlist — Public API <code>spotifyUrl</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spotify">Spotify URL</Label>
              <Input
                id="spotify"
                placeholder="https://open.spotify.com/track/… or /playlist/…"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Campaign name (optional)</Label>
              <Input
                id="name"
                placeholder={`auto: ${user.handle}_…`}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Prefixed with <code>{user.handle}_</code> for partner-side artist
                mapping.
              </p>
            </div>
            <Button
              onClick={() => setStep(1)}
              disabled={!spotifyUrl.includes("spotify.com")}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clapperboard className="size-4 text-primary" />
              Creative direction
            </CardTitle>
            <CardDescription>
              <code>do_it_for_me</code> generates ads;{" "}
              <code>full_control</code> uses your selected creatives (imported
              on launch).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <RadioGroup
              value={creativeMode}
              onValueChange={(v) =>
                setCreativeMode(v as "do_it_for_me" | "full_control")
              }
              className="grid gap-3 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer gap-3 rounded-xl border border-border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/50">
                <RadioGroupItem value="do_it_for_me" />
                <div>
                  <p className="font-medium">Do it for me</p>
                  <p className="text-xs text-muted-foreground">
                    Soundlink generates creatives. Next you still pick genre
                    (used for targeting & creative packs).
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-xl border border-border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/50">
                <RadioGroupItem value="full_control" />
                <div>
                  <p className="font-medium">Full control</p>
                  <p className="text-xs text-muted-foreground">
                    Pick videos now. Genre still comes next (same as product UI).
                  </p>
                </div>
              </label>
            </RadioGroup>

            {creativeMode === "full_control" && (
              <FullControlCreativesPicker
                selected={selectedCreatives}
                onChange={setSelectedCreatives}
              />
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={
                  creativeMode === "full_control" &&
                  selectedCreatives.length === 0
                }
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe2 className="size-4 text-primary" />
              Genre
            </CardTitle>
            <CardDescription>
              Required for both creative modes (Public API + product UI).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>What&apos;s your vibe?</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {PUBLIC_API_GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Creative mode: <strong>{creativeMode}</strong> — genre still
              applies.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!genre}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="size-4 text-primary" />
              Strategy & budget
            </CardTitle>
            <CardDescription>
              Spend guard: ${SPEND_GUARD.maxDailyBudgetUsd}/day ×{" "}
              {SPEND_GUARD.maxDurationDays} days.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Strategy</Label>
              <Select value={strategyType} onValueChange={setStrategyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maximum_growth">maximum_growth</SelectItem>
                  <SelectItem value="market_discovery">
                    market_discovery
                  </SelectItem>
                  <SelectItem value="revenue_maximization">
                    revenue_maximization
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Daily budget (USD)</Label>
              <Input
                type="number"
                min={SPEND_GUARD.minDailyBudgetUsd}
                max={SPEND_GUARD.maxDailyBudgetUsd}
                step={1}
                value={dailyBudget}
                onChange={(e) => setDailyBudget(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input
                type="number"
                min={SPEND_GUARD.minDurationDays}
                max={SPEND_GUARD.maxDurationDays}
                step={1}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-accent/70 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="size-4 text-primary" />
                Cycle cost reserved from wallet
              </div>
              <span className="text-lg font-semibold">${total}</span>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => setStep(4)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-4 text-primary" />
              Review & launch
            </CardTitle>
            <CardDescription>
              Calls <code>POST /v1/campaigns</code> with Idempotency-Key —
              reserves ${total} from the org wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">Artist</dt>
                <dd className="font-medium">{user.name}</dd>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">Genre</dt>
                <dd className="font-medium">{genre}</dd>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Spotify</dt>
                <dd className="truncate font-medium">{spotifyUrl}</dd>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">Creative</dt>
                <dd className="font-medium">
                  {creativeMode}
                  {creativeMode === "full_control"
                    ? ` · ${selectedCreatives.length} video(s)`
                    : ""}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">Strategy</dt>
                <dd className="font-medium">{strategyType}</dd>
              </div>
              <div className="rounded-lg bg-primary/10 p-3 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Wallet reserve</dt>
                <dd className="text-lg font-semibold">
                  ${dailyBudget}/day × {durationDays}d = ${total}
                </dd>
              </div>
            </dl>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting
                  ? creativeMode === "full_control"
                    ? "Importing creatives & creating…"
                    : "Creating…"
                  : "Create campaign via Public API"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
