import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from './i18n/routing'

const intl = createMiddleware(routing)

/** Old Weebly pages (`/x.html`) and uploads, handled by the legacy catch-all. */
const LEGACY = /\.html$|^\/uploads\//

/** The article pages that show `community` articles to a signed-in reader. */
const ARTICLES = /^\/(en|ar)(\/articles(?:\/[^/]+)?)\/?$/

/** Payload's login cookie (no `cookiePrefix` is set). */
const SESSION_COOKIE = 'payload-token'

/** The visitor's saved site language, else the default. */
const savedLocale = (request: NextRequest) => {
  const saved = request.cookies.get('NEXT_LOCALE')?.value
  return routing.locales.find((l) => l === saved) ?? routing.defaultLocale
}

/** The site's login page, in the visitor's language. */
const loginFor = (request: NextRequest) => {
  const url = request.nextUrl.clone()
  url.pathname = `/${savedLocale(request)}/login`
  // Payload's own `redirect` names the admin page to return to.
  url.search = ''
  url.searchParams.set('next', request.nextUrl.searchParams.get('redirect') ?? '/admin')
  return url
}

/**
 * Adds the site language to every public path (ADR 0006). Legacy paths
 * have dots, which the language redirect would skip, so they are rewritten
 * under the visitor's language for the catch-all route to look up.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // One login screen for the site and the admin panel.
  if (pathname === '/admin/login') return NextResponse.redirect(loginFor(request))
  if (LEGACY.test(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = `/${savedLocale(request)}${pathname}`
    return NextResponse.rewrite(url)
  }
  // A signed-in reader gets the uncached article pages, which also show
  // `community` articles; everyone else keeps the cached ones. A stale cookie
  // just renders as anonymous there.
  const article = ARTICLES.exec(pathname)
  if (article && request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone()
    url.pathname = `/${article[1]}/signed-in${article[2]}`
    return NextResponse.rewrite(url)
  }
  return intl(request)
}

export const config = {
  // Everything except Payload (/admin, /api), Next internals and static files;
  // `.html` pages and `/uploads/...` are let through for the legacy lookup,
  // and /admin/login to send it to the site's login page.
  matcher: [
    '/((?!api|admin|_next|_vercel|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|txt|xml|json|woff2?|pdf)$).*)',
    '/uploads/:path*',
    '/admin/login',
  ],
}
