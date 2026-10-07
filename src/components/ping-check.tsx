"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function PingCheck() {
  const [result, setResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  async function runPing() {
    setLoading(true)
    try {
      const response = await fetch("/api/ping")
      setResult(await response.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API connection</CardTitle>
        <CardDescription>
          Calls <code>GET /v1/ping</code> from the server with the configured API key.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button onClick={runPing} disabled={loading} className="w-fit">
          {loading ? "Pinging…" : "Ping Soundlink API"}
        </Button>
        {result !== null && (
          <pre className="bg-muted overflow-x-auto rounded-md p-4 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}
