import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from './i18n/routing'

const intl = createMiddleware(routing)

/** Old Weebly pages (`/x.html`) and uploads, handled by the legacy catch-all. */
const LEGACY = /\.html$|^\/uploads\//

/**
 * Adds the site language to every public path (ADR 0006). Legacy paths
 * have dots, which the language redirect would skip, so they are rewritten
 * under the visitor's language for the catch-all route to look up.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (LEGACY.test(pathname)) {
    const saved = request.cookies.get('NEXT_LOCALE')?.value
    const locale = routing.locales.find((l) => l === saved) ?? routing.defaultLocale
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}${pathname}`
    return NextResponse.rewrite(url)
  }
  return intl(request)
}

export const config = {
  // Everything except Payload (/admin, /api), Next internals and static files;
  // `.html` pages and `/uploads/...` are let through for the legacy lookup.
  matcher: [
    '/((?!api|admin|_next|_vercel|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|txt|xml|json|woff2?|pdf)$).*)',
    '/uploads/:path*',
  ],
}
