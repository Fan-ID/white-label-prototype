import { NextResponse } from "next/server"
import { soundlinkRequest } from "@/lib/soundlink-api"

export async function GET() {
  try {
    const result = await soundlinkRequest("GET", "/v1/ping")
    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
