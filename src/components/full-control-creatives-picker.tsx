"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, Plus, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export const FULL_CONTROL_MAX_VIDEOS = 10
export const FULL_CONTROL_MIN_VIDEOS = 1

export type CreativePick = {
  key: string
  title: string
  previewUrl: string
  importUrl: string
  videoId: string | null
}

type DemoCreative = {
  filename: string
  path: string
  title: string
}

type LibraryVideo = {
  id: string
  videoId: string | null
  title: string
  sourceUrl: string
  status: string
}

export function FullControlCreativesPicker({
  selected,
  onChange,
}: {
  selected: CreativePick[]
  onChange: (next: CreativePick[]) => void
}) {
  const [demos, setDemos] = useState<DemoCreative[]>([])
  const [library, setLibrary] = useState<LibraryVideo[]>([])
  const [addUrl, setAddUrl] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [isHttpsOrigin, setIsHttpsOrigin] = useState(true)

  const loadLibrary = useCallback(async () => {
    const res = await fetch("/api/videos")
    const json = await res.json()
    setLibrary(json.videos ?? [])
  }, [])

  useEffect(() => {
    setIsHttpsOrigin(window.location.protocol === "https:")
    void fetch("/api/creatives/demo")
      .then((r) => r.json())
      .then((json) => setDemos(json.creatives ?? []))
    void loadLibrary()
  }, [loadLibrary])

  const selectedKeys = new Set(selected.map((s) => s.key))

  function toggle(pick: CreativePick) {
    if (selectedKeys.has(pick.key)) {
      onChange(selected.filter((s) => s.key !== pick.key))
      return
    }
    if (selected.length >= FULL_CONTROL_MAX_VIDEOS) return
    onChange([...selected, pick])
  }

  async function pollUntilReady(id: string, sessionId: string) {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      const res = await fetch("/api/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sessionId }),
      })
      const json = await res.json()
      if (
        json.status === "ready" ||
        json.status === "failed" ||
        json.status === "partial"
      ) {
        return json as { status: string; videoId?: string | null }
      }
    }
    return { status: "processing" as const, videoId: null }
  }

  async function addFromUrl(e: React.FormEvent) {
    e.preventDefault()
    const url = addUrl.trim()
    if (!/^https:\/\//i.test(url)) {
      setAddError("Public HTTPS URL required (Soundlink import constraint).")
      return
    }
    if (selected.length >= FULL_CONTROL_MAX_VIDEOS) {
      setAddError(`Max ${FULL_CONTROL_MAX_VIDEOS} creatives.`)
      return
    }

    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAddError(json.error || "Import failed")
        return
      }

      let videoId = json.video?.videoId as string | null
      let status = json.video?.status as string
      if (json.video?.sessionId && status !== "ready") {
        const polled = await pollUntilReady(json.video.id, json.video.sessionId)
        status = polled.status
        videoId = polled.videoId ?? null
      }

      await loadLibrary()

      if (status !== "ready" || !videoId) {
        setAddError(
          status === "failed"
            ? "Import failed on Soundlink."
            : "Still processing — try selecting it when ready.",
        )
        setAddUrl("")
        return
      }

      const pick: CreativePick = {
        key: `library:${videoId}`,
        title: json.video?.title || "Creative",
        previewUrl: url,
        importUrl: url,
        videoId,
      }
      if (!selectedKeys.has(pick.key)) {
        onChange([...selected, pick].slice(0, FULL_CONTROL_MAX_VIDEOS))
      }
      setAddUrl("")
    } finally {
      setAdding(false)
    }
  }

  const readyLibrary = library.filter((v) => v.status === "ready" && v.videoId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Select creatives</p>
          <p className="text-xs text-muted-foreground">
            {selected.length}/{FULL_CONTROL_MAX_VIDEOS} selected · min{" "}
            {FULL_CONTROL_MIN_VIDEOS} (same idea as product UI)
          </p>
        </div>
      </div>

      {!isHttpsOrigin && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Demo clips preview here, but Soundlink import needs a public HTTPS
          URL — use Vercel preview, or Add URL below with a CDN link.
        </p>
      )}

      {demos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Catalog
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {demos.map((demo) => {
              const key = `demo:${demo.path}`
              const pick: CreativePick = {
                key,
                title: demo.title,
                previewUrl: demo.path,
                importUrl: demo.path,
                videoId: null,
              }
              const isOn = selectedKeys.has(key)
              return (
                <CreativeTile
                  key={key}
                  pick={pick}
                  selected={isOn}
                  disabled={!isOn && selected.length >= FULL_CONTROL_MAX_VIDEOS}
                  onToggle={() => toggle(pick)}
                />
              )
            })}
          </div>
        </div>
      )}

      {readyLibrary.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Imported library
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {readyLibrary.map((video) => {
              const key = `library:${video.videoId}`
              const pick: CreativePick = {
                key,
                title: video.title,
                previewUrl: video.sourceUrl,
                importUrl: video.sourceUrl,
                videoId: video.videoId,
              }
              const isOn = selectedKeys.has(key)
              return (
                <CreativeTile
                  key={key}
                  pick={pick}
                  selected={isOn}
                  disabled={!isOn && selected.length >= FULL_CONTROL_MAX_VIDEOS}
                  onToggle={() => toggle(pick)}
                />
              )
            })}
          </div>
        </div>
      )}

      {demos.length === 0 && readyLibrary.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No creatives yet. Add a public HTTPS MP4 URL below.
        </p>
      )}

      <form
        onSubmit={addFromUrl}
        className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"
      >
        <Label htmlFor="add-creative-url" className="flex items-center gap-1.5">
          <Plus className="size-3.5" />
          Add more (HTTPS URL)
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="add-creative-url"
            placeholder="https://cdn.example.com/clip.mp4"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            disabled={adding}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={adding || !addUrl.trim()}
            className="shrink-0"
          >
            {adding ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Importing…
              </>
            ) : (
              "Import & select"
            )}
          </Button>
        </div>
        {addError && (
          <p className="text-xs text-destructive">{addError}</p>
        )}
      </form>
    </div>
  )
}

function CreativeTile({
  pick,
  selected,
  disabled,
  onToggle,
}: {
  pick: CreativePick
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "overflow-hidden rounded-xl border text-left transition",
        selected
          ? "border-primary bg-accent/40 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40",
        disabled && "opacity-50",
      )}
    >
      <div className="relative aspect-[9/16] max-h-48 bg-muted">
        <video
          src={pick.previewUrl}
          className="size-full object-cover"
          muted
          playsInline
          preload="metadata"
          onMouseEnter={(e) => void e.currentTarget.play().catch(() => { })}
          onMouseLeave={(e) => {
            e.currentTarget.pause()
            e.currentTarget.currentTime = 0
          }}
        />
        {selected && (
          <Badge className="absolute right-2 top-2 gap-1">
            <Check className="size-3" />
            Selected
          </Badge>
        )}
      </div>
      <div className="flex items-start gap-2 p-3">
        <Video className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{pick.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {pick.videoId ? `videoId · ${pick.videoId.slice(0, 8)}…` : "Import on launch"}
          </p>
        </div>
      </div>
    </button>
  )
}

export async function resolveCreativeVideoIds(
  picks: CreativePick[],
): Promise<string[]> {
  if (picks.length < FULL_CONTROL_MIN_VIDEOS) {
    throw new Error("Select at least one creative.")
  }

  const ids: string[] = []

  for (const pick of picks) {
    if (pick.videoId) {
      ids.push(pick.videoId)
      continue
    }

    const absolute = new URL(pick.importUrl, window.location.origin).href
    if (!absolute.startsWith("https://")) {
      throw new Error(
        `Cannot import "${pick.title}" from ${absolute}. Use Vercel preview (HTTPS) or Add URL with a public CDN link.`,
      )
    }

    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: absolute, title: pick.title }),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || `Failed to import ${pick.title}`)
    }

    let videoId = json.video?.videoId as string | null
    let status = json.video?.status as string
    const localId = json.video?.id as string
    const sessionId = json.video?.sessionId as string | null

    if (sessionId && status !== "ready") {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const poll = await fetch("/api/videos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: localId, sessionId }),
        })
        const body = await poll.json()
        status = body.status
        videoId = body.videoId ?? null
        if (status === "ready" || status === "failed" || status === "partial") {
          break
        }
      }
    }

    if (status !== "ready" || !videoId) {
      throw new Error(
        `Import for "${pick.title}" did not become ready (status: ${status}).`,
      )
    }
    ids.push(videoId)
  }

  return ids
}
