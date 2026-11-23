// After `pnpm build`: the public pages are prerendered, and the pages that read
// the reader's session are not. A page turns dynamic when anything in its tree
// reads the request (headers, cookies, search params); Next then drops it from
// the prerender manifest without an error, so only this check shows it.
import { readFileSync } from 'node:fs'

const { routes, dynamicRoutes } = JSON.parse(readFileSync('.next/prerender-manifest.json', 'utf8'))

const LOCALES = ['en', 'ar']
const STATIC_PAGES = [
  '',
  '/about',
  '/apply',
  '/contact',
  '/governance',
  '/people/cilasians',
  '/people/fellows',
  '/study/bridge',
]
// Pages with a [slug]: each page is added as it is published, so the manifest lists the route.
const STATIC_PATTERNS = ['/[locale]/study/[slug]', '/[locale]/articles/[slug]']
// Pages that read the session or the request: they must stay dynamic.
const DYNAMIC_PAGES = ['/login', '/settings', '/profile', '/signed-in']

const missing = LOCALES.flatMap((l) => STATIC_PAGES.map((p) => `/${l}${p}`)).filter(
  (path) => !(path in routes),
)
const missingPatterns = STATIC_PATTERNS.filter((pattern) => !(pattern in dynamicRoutes))
const wrongStatic = LOCALES.flatMap((l) => DYNAMIC_PAGES.map((p) => `/${l}${p}`)).filter(
  (path) => path in routes,
)

const problems = [
  ...[...missing, ...missingPatterns].map((path) => `not prerendered: ${path}`),
  ...wrongStatic.map((path) => `prerendered but reads the session: ${path}`),
]
if (problems.length) {
  console.error(problems.join('\n'))
  console.error(
    'A public page turns dynamic when anything in its tree reads the request.\n' +
      'Run `next build --debug` to see which call, and where.',
  )
  process.exit(1)
}
console.log(`Static routes ok: ${Object.keys(routes).length} prerendered.`)
