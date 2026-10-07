import { NextResponse } from "next/server"
import { listRecentApiCalls } from "@/lib/db"

export async function GET() {
  const calls = await listRecentApiCalls(40)
  return NextResponse.json({ calls })
}
