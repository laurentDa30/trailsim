import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// "/b/" is the volunteers' token-link view: access IS the token, no account.
const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/b/"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    /\.(png|jpg|jpeg|svg|ico|css|js|woff2?)$/.test(pathname)

  if (isPublic) return NextResponse.next()

  const sessionCookie =
    request.cookies.get("next-auth.session-token") ??
    request.cookies.get("__Secure-next-auth.session-token") ??
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token")

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
}
