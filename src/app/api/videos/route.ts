import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { insertVideo, listVideos, updateVideo } from "@/lib/db"
import { soundlinkRequest } from "@/lib/soundlink-api"

export async function GET() {
  const videos = await listVideos()
  return NextResponse.json({ videos })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string; title?: string }
    const url = body.url?.trim()
    if (!url || !/^https:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "A public HTTPS URL is required (Public API import constraint)." },
        { status: 400 },
      )
    }

    const id = randomUUID()
    const title = body.title?.trim() || deriveTitle(url)

    const result = await soundlinkRequest<{
      data?: { sessionId?: string; videoId?: string; status?: string }
      sessionId?: string
      videoId?: string
      status?: string
    }>("POST", "/v1/videos/import", { url })

    if (!result.ok) {
      await insertVideo({
        id,
        title,
        sourceUrl: url,
        status: "failed",
      })
      return NextResponse.json(
        { error: "Video import rejected by Soundlink API", api: result },
        { status: 502 },
      )
    }

    const payload = result.data as {
      data?: { sessionId?: string; videoId?: string; status?: string }
      sessionId?: string
      videoId?: string
      status?: string
    }
    const sessionId = payload.data?.sessionId || payload.sessionId || null
    const videoId = payload.data?.videoId || payload.videoId || null
    const status =
      payload.data?.status ||
      payload.status ||
      (videoId ? "ready" : "processing")

    await insertVideo({
      id,
      title,
      sourceUrl: url,
      status,
      sessionId,
      videoId,
    })

    return NextResponse.json({
      ok: true,
      video: { id, title, sourceUrl: url, status, sessionId, videoId },
      api: result,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: string; sessionId?: string }
  if (!body.id || !body.sessionId) {
    return NextResponse.json(
      { error: "id and sessionId required" },
      { status: 400 },
    )
  }

  const result = await soundlinkRequest<{
    data?: { status?: string; videoId?: string }
    status?: string
    videoId?: string
  }>("GET", `/v1/videos/import/${body.sessionId}`)

  if (!result.ok) {
    return NextResponse.json({ api: result }, { status: 502 })
  }

  const payload = result.data as {
    data?: { status?: string; videoId?: string }
    status?: string
    videoId?: string
  }
  const status = payload.data?.status || payload.status || "processing"
  const videoId = payload.data?.videoId || payload.videoId || null

  await updateVideo(body.id, { status, videoId })

  return NextResponse.json({
    ok: true,
    status,
    videoId,
    api: result,
  })
}

function deriveTitle(url: string) {
  try {
    const pathname = new URL(url).pathname
    const file = pathname.split("/").filter(Boolean).pop() || "creative"
    return decodeURIComponent(file.replace(/\.[^.]+$/, "")).slice(0, 64)
  } catch {
    return "Creative"
  }
}
