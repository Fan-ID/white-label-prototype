"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Film,
  Link2,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

type Video = {
  id: string
  videoId: string | null
  title: string
  sourceUrl: string
  status: string
  sessionId: string | null
  createdAt: string
}

export function CreativesManager() {
  const [videos, setVideos] = useState<Video[]>([])
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const load = useCallback(async () => {
    const res = await fetch("/api/videos")
    const json = await res.json()
    setVideos(json.videos ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function pollUntilReady(id: string, sessionId: string) {
    setProgress(20)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      setProgress(Math.min(90, 20 + i * 4))
      const res = await fetch("/api/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sessionId }),
      })
      const json = await res.json()
      if (json.status === "ready" || json.status === "failed" || json.status === "partial") {
        setProgress(100)
        return
      }
    }
  }

  async function importVideo(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setProgress(8)
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title: title || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Import failed")
        return
      }
      if (json.video?.sessionId && json.video.status !== "ready") {
        await pollUntilReady(json.video.id, json.video.sessionId)
      } else {
        setProgress(100)
      }
      setUrl("")
      setTitle("")
      await load()
    } finally {
      setBusy(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  const readyCount = videos.filter((v) => v.status === "ready" && v.videoId).length

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="overflow-hidden border-primary/20">
        <div className="border-b border-border/60 bg-gradient-to-br from-primary/10 via-transparent to-soundlink/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <UploadCloud className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Import creatives</CardTitle>
              <CardDescription className="mt-1 max-w-md">
                Soundlink&apos;s Public API only accepts a{" "}
                <strong>public HTTPS MP4/MOV URL</strong> — not a local file.
                Paste a CDN link; we call{" "}
                <code className="text-xs">POST /v1/videos/import</code>, then
                poll until ready.
              </CardDescription>
            </div>
          </div>
        </div>
        <CardContent className="space-y-5 pt-6">
          <form onSubmit={importVideo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-url">Public video URL</Label>
              <div className="relative">
                <Link2 className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                <Input
                  id="video-url"
                  placeholder="https://cdn.example.com/promo.mp4"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-title">Title (optional)</Label>
              <Input
                id="video-title"
                placeholder="Sunset hook · cut 01"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                How Groover would do this
              </p>
              <Textarea
                readOnly
                className="min-h-[88px] resize-none font-mono text-[11px]"
                value={`POST /v1/videos/import\n{ "url": "${url || "https://…/clip.mp4"}" }\n→ poll GET /v1/videos/import/{sessionId}\n→ use videoId in campaign full_control`}
              />
            </div>
            {busy && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Importing via Soundlink…
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || !url} className="w-full sm:w-auto">
              {busy ? "Importing…" : "Import to Soundlink library"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Creative library</CardTitle>
            <CardDescription>
              {readyCount} ready for full_control campaigns
            </CardDescription>
          </div>
          <Button variant="outline" size="icon-sm" onClick={load}>
            <RefreshCw className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {videos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <Film className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No creatives yet. Import 1–5 public URLs to demo full_control.
              </p>
            </div>
          ) : (
            videos.map((video) => (
              <div
                key={video.id}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-3"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  {video.status === "ready" ? (
                    <CheckCircle2 className="size-5 text-soundlink" />
                  ) : video.status === "processing" ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <Film className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{video.title}</p>
                    <Badge
                      variant={
                        video.status === "ready"
                          ? "secondary"
                          : video.status === "failed"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {video.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {video.videoId
                      ? `videoId: ${video.videoId}`
                      : video.sourceUrl}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
