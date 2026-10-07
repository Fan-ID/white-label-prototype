"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clapperboard, Database, Megaphone, Plus } from "lucide-react"
import { type PartnerUser } from "@/lib/db"
import { ArtistSession } from "@/components/artist-session"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function NavLink({
  href,
  children,
  icon,
}: {
  href: string
  children: React.ReactNode
  icon: React.ReactNode
}) {
  const pathname = usePathname()
  const active =
    pathname === href || (href !== "/campaigns" && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  )
}

export function AppShell({
  user,
  children,
}: {
  user: PartnerUser | null
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-8 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur sm:grid-cols-[1fr_auto_1fr] sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={user ? "/campaigns" : "/"} className="shrink-0">
            <Image
              src="/images/logo.png"
              alt="Groover"
              width={140}
              height={48}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>
          <div className="hidden h-6 w-px bg-border md:block" />
          <p className="hidden text-xs text-muted-foreground md:block">
            Ads by{" "}
            <span className="font-semibold text-soundlink">Soundlink</span>
          </p>
        </div>

        {user ? (
          <>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink href="/campaigns" icon={<Megaphone className="size-3.5" />}>
                Campaigns
              </NavLink>
              <NavLink
                href="/creatives"
                icon={<Clapperboard className="size-3.5" />}
              >
                Creatives
              </NavLink>
              <NavLink href="/admin" icon={<Database className="size-3.5" />}>
                Admin
              </NavLink>
            </nav>

            <div className="flex items-center justify-end gap-2">
              <Button asChild size="sm" className="hidden rounded-full sm:inline-flex">
                <Link href="/campaigns/new">
                  <Plus className="size-3.5" />
                  Launch ads
                </Link>
              </Button>
              <Button
                asChild
                size="icon-sm"
                className="rounded-full sm:hidden"
                title="Launch ads"
              >
                <Link href="/campaigns/new">
                  <Plus className="size-4" />
                </Link>
              </Button>
              <ArtistSession user={user} />
            </div>
          </>
        ) : (
          <div className="col-span-1 sm:col-span-2" />
        )}
      </header>

      {user && (
        <nav className="mb-5 flex gap-1 overflow-x-auto sm:hidden">
          <NavLink href="/campaigns" icon={<Megaphone className="size-3.5" />}>
            Campaigns
          </NavLink>
          <NavLink
            href="/creatives"
            icon={<Clapperboard className="size-3.5" />}
          >
            Creatives
          </NavLink>
          <NavLink href="/admin" icon={<Database className="size-3.5" />}>
            Admin
          </NavLink>
        </nav>
      )}

      {children}

      <footer className="mt-12 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
        Prototype for Groover × Soundlink white-label · Public API only ·
        Spend guard active ($10/day × 7 days max)
      </footer>
    </div>
  )
}
