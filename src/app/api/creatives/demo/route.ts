import { NextResponse } from "next/server"
import { listDemoCreatives } from "@/lib/demo-creatives"

export async function GET() {
  const creatives = await listDemoCreatives()
  return NextResponse.json({ creatives })
}
