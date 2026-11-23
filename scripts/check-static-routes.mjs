import { existsSync, readFileSync } from 'node:fs'

import {
  BRIDGE_APPLY_PATH,
  BRIDGE_PATH,
  PUBLIC_LAYOUT_PATTERNS,
  PUBLIC_LISTS_TAG,
} from '../src/lib/paths.ts'

import { articleSlug, courseSlug } from './smoke.fixture.ts'

const { routes, dynamicRoutes, notFoundRoutes } = JSON.parse(
  readFileSync('.next/prerender-manifest.json', 'utf8'),
)

const LOCALES = ['en', 'ar']
const STATIC_ROUTES = [
  ...[
    '',
    '/apply',
    '/governance',
    '/people/cilasians',
    '/people/fellows',
    BRIDGE_PATH,
    `/study/${courseSlug}`,
  ].map((page) => ({ page, status: 200 })),
  { page: '/contact', status: 200, layout: PUBLIC_LAYOUT_PATTERNS.contact },
  { page: BRIDGE_APPLY_PATH, status: 200, layout: PUBLIC_LAYOUT_PATTERNS.bridgeApply },
  { page: `/articles/${articleSlug}`, status: 200, layout: PUBLIC_LAYOUT_PATTERNS.article },
  { page: '/about', status: 308, redirect: '' },
]
const DYNAMIC_PAGES = [
  '/login',
  '/settings',
  '/profile',
  '/signed-in',
  '/signed-in/apply',
  '/signed-in/articles',
  `/signed-in/articles/${articleSlug}`,
  `/signed-in/study/${courseSlug}`,
  `/signed-in/study/${courseSlug}/apply`,
]
const DYNAMIC_PATTERNS = [
  '/[locale]/signed-in/articles/[slug]',
  '/[locale]/signed-in/study/[slug]',
  '/[locale]/signed-in/study/[slug]/apply',
]

const problems = []
for (const locale of LOCALES) {
  for (const { page, status: expectedStatus, redirect, layout } of STATIC_ROUTES) {
    const path = `/${locale}${page}`
    const route = routes[path]
    const artifact = `.next/server/app${path}`
    if (
      route?.response !== 'complete' ||
      !existsSync(`${artifact}.meta`) ||
      !existsSync(`${artifact}.html`)
    ) {
      problems.push(`not prerendered: ${path}`)
      continue
    }

    const { status, headers } = JSON.parse(readFileSync(`${artifact}.meta`, 'utf8'))
    const actualStatus = notFoundRoutes.includes(path)
      ? 404
      : (route.initialStatus ?? status ?? 200)
    if (actualStatus !== expectedStatus) {
      problems.push(`expected HTTP ${expectedStatus} at ${path}, got ${actualStatus}`)
    }
    if (redirect !== undefined && headers?.location !== `/${locale}${redirect}`) {
      problems.push(`expected ${path} to redirect to /${locale}${redirect}`)
    }
    if (route.initialRevalidateSeconds !== 300) {
      problems.push(`expected 300s revalidation at ${path}, got ${route.initialRevalidateSeconds}`)
    }
    const tags = headers?.['x-next-cache-tags']?.split(',') ?? []
    if (!tags.includes(PUBLIC_LISTS_TAG)) {
      problems.push(`missing ${PUBLIC_LISTS_TAG} cache tag: ${path}`)
    }
    if (layout && !tags.includes(`_N_T_${layout}/layout`)) {
      problems.push(`missing layout cache tag _N_T_${layout}/layout: ${path}`)
    }
  }
  for (const page of DYNAMIC_PAGES) {
    const path = `/${locale}${page}`
    if (path in routes || notFoundRoutes.includes(path)) {
      problems.push(`prerendered but reads the session: ${path}`)
    }
  }
}
for (const pattern of DYNAMIC_PATTERNS) {
  if (pattern in dynamicRoutes) problems.push(`cacheable but reads the session: ${pattern}`)
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Static routes ok: ${STATIC_ROUTES.length * LOCALES.length} checked.`)
