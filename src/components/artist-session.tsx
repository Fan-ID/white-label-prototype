"use client"

import { useRouter } from "next/navigation"
import { ArrowLeftRight } from "lucide-react"
import type { PartnerUser } from "@/lib/db"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
}

export function ArtistSession({ user }: { user: PartnerUser }) {
  const router = useRouter()

  async function switchArtist() {
    await fetch("/api/session", { method: "DELETE" })
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/80 py-1 pr-1 pl-1.5 shadow-sm">
      <Avatar size="sm" className="size-8">
        <AvatarFallback
          className="text-[11px] font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, hsl(${user.avatarHue} 85% 55%), hsl(${user.avatarHue + 28} 80% 42%))`,
          }}
        >
          {initials(user.name)}
        </AvatarFallback>
      </Avatar>

      <div className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="max-w-[120px] truncate text-xs font-semibold">
          {user.name}
        </span>
        <span className="max-w-[120px] truncate text-[11px] text-muted-foreground">
          @{user.handle}
        </span>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={switchArtist}
        title="Switch artist"
        aria-label="Switch artist"
        className="rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ArrowLeftRight className="size-3.5" />
      </Button>
    </div>
  )
}
