import { NextResponse, type NextRequest } from "next/server"
import { ADMIN_USER_ID, SESSION_COOKIE } from "@/lib/config"

export function middleware(request: NextRequest) {
  const userId = request.cookies.get(SESSION_COOKIE)?.value
  const path = request.nextUrl.pathname
  const isAdmin = userId === ADMIN_USER_ID

  if (isAdmin) {
    if (path.startsWith("/campaigns") || path.startsWith("/creatives")) {
      return NextResponse.redirect(new URL("/admin", request.url))
    }
    return NextResponse.next()
  }

  if (path.startsWith("/admin")) {
    if (!userId) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.redirect(new URL("/campaigns", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/campaigns/:path*", "/creatives/:path*"],
}
