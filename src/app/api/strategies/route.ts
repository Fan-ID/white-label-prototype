import { NextResponse } from "next/server"
import { soundlinkRequest } from "@/lib/soundlink-api"

export async function GET() {
  const result = await soundlinkRequest("GET", "/v1/strategies")
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
