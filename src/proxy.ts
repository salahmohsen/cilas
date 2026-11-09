import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from './i18n/routing'

const intl = createMiddleware(routing)

/**
 * Discovery for Claude and ChatGPT: the two documents live at the site's root
 * (RFC 8414, RFC 9728) and Payload serves them under /api. This is what the
 * OAuth plugin's own middleware does; its other rewrite (a bare-host POST)
 * stays off, because the address an admin pastes is /api/mcp. Clients may also
 * ask for the resource document under the server's path.
 */
const PRM_FOR_MCP = '/.well-known/oauth-protected-resource/api/mcp'
const WELL_KNOWN_OAUTH = /^\/\.well-known\/oauth-(authorization-server|protected-resource)$/

/** Old Weebly pages (`/x.html`) and uploads, handled by the legacy catch-all. */
const LEGACY = /\.html$|^\/uploads\//

/**
 * The pages that show `community` work to a signed-in reader: home and Open
 * for registration (what is open), the articles, a person's page, and a
 * course with its application. The Bridge has its own pages under /study and stays cached.
 */
const SIGNED_IN =
  /^\/(en|ar)((?:\/articles(?:\/[^/]+)?|\/people\/[^/]+|\/apply|\/study\/(?!bridge(?:\/|$))[^/]+(?:\/apply)?)?)\/?$/

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
  // Payload's own `redirect` names the admin page to return to; without one, My spaces.
  url.search = ''
  url.searchParams.set(
    'next',
    request.nextUrl.searchParams.get('redirect') ?? `/${savedLocale(request)}/spaces`,
  )
  return url
}

/**
 * Adds the site language to every public path (ADR 0006). Legacy paths
 * have dots, which the language redirect would skip, so they are rewritten
 * under the visitor's language for the catch-all route to look up.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === PRM_FOR_MCP) {
    const url = request.nextUrl.clone()
    url.pathname = '/api/.well-known/oauth-protected-resource'
    return NextResponse.rewrite(url)
  }
  if (WELL_KNOWN_OAUTH.test(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = `/api${pathname}`
    return NextResponse.rewrite(url)
  }
  // next.config.ts turns Next's trailing-slash redirect off (PostHog needs
  // that); this keeps it for the site's pages: /en/about/ is /en/about.
  if (pathname.length > 1 && pathname.endsWith('/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.replace(/\/+$/, '')
    return NextResponse.redirect(url, 308)
  }
  // One login screen for the site and the admin panel.
  if (pathname === '/admin/login') return NextResponse.redirect(loginFor(request))
  // And one reset flow: Payload's own pages are sent to the site's, in the
  // visitor's language. The reset email still links to /admin/reset/<token>.
  if (pathname === '/admin/forgot' || pathname === '/admin/forgot-password') {
    return NextResponse.redirect(new URL(`/${savedLocale(request)}/forgot`, request.url))
  }
  const reset = /^\/admin\/reset\/([^/]+)\/?$/.exec(pathname)
  if (reset) {
    return NextResponse.redirect(new URL(`/${savedLocale(request)}/reset/${reset[1]}`, request.url))
  }
  if (LEGACY.test(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = `/${savedLocale(request)}${pathname}`
    return NextResponse.rewrite(url)
  }
  // A signed-in reader gets the uncached pages, which also show `community`
  // work; everyone else keeps the cached ones. A stale cookie just renders
  // as anonymous there.
  const page = SIGNED_IN.exec(pathname)
  if (page && request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone()
    url.pathname = `/${page[1]}/signed-in${page[2]}`
    return NextResponse.rewrite(url)
  }
  return intl(request)
}

export const config = {
  // Everything except Payload (/admin, /api), the analytics forwarding
  // (/relay-k3, which must never be redirected to a language), Next internals and static files
  // (the web app manifest included: it is not under a locale); `.html` pages
  // and `/uploads/...` are let through for the legacy lookup, and the
  // admin's login, forgot and reset pages to send them to the site's own.
  matcher: [
    '/((?!api|admin|relay-k3|_next|_vercel|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|txt|xml|json|webmanifest|woff2?|pdf)$).*)',
    '/uploads/:path*',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/api/mcp',
    '/admin/login',
    '/admin/forgot',
    '/admin/forgot-password',
    '/admin/reset/:token',
  ],
}
