import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { login } from '../testing/login.test-utils'
import { createTracker, uniq } from '../testing/payload.fixture'
import {
  holdSpacesMode,
  inContext as inContextAt,
  LOCALES,
  localePath,
  portalWorld,
  ROLES,
  WIDTHS,
  type Locale,
  type PortalRole,
  type PortalWorld,
  type StorageState,
} from '../testing/portal.fixture'
import KNOWN from './portal-axe-known.json'

type Viewport = (typeof WIDTHS)[keyof typeof WIDTHS]

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const ROUTE_SHAPES = [
  ['/spaces', /^\/[a-z]{2}\/spaces$/],
  ['/spaces/course/*', /^\/[a-z]{2}\/spaces\/course\/[^/]+$/],
  ['/spaces/community', /^\/[a-z]{2}\/spaces\/community$/],
  ['/spaces/community/*', /^\/[a-z]{2}\/spaces\/community\/[^/]+$/],
] as const

type RouteShape = (typeof ROUTE_SHAPES)[number][0]
type Known = Partial<Record<RouteShape, Record<string, Record<string, number>>>>

const shapeOf = (route: string) => {
  const shape = ROUTE_SHAPES.find(([, pattern]) => pattern.test(route))
  if (!shape) throw new Error(`no route shape for ${route}`)
  return shape[0]
}

const known = (route: string, role: PortalRole, locale: Locale, width: number) =>
  (KNOWN as Known)[shapeOf(route)]?.[`${role} ${locale} ${width}`] ?? {}

const portalRoutes = (world: PortalWorld, locale: Locale) =>
  ['/en/spaces', world.course.path, '/en/spaces/community', world.community.path].map((path) =>
    localePath(path, locale),
  )

const axeCounts = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('nextjs-portal')
    .analyze()
  return Object.fromEntries(violations.map((v) => [v.id, v.nodes.length]))
}

const { track, cleanup } = createTracker()
let payload: Payload
let world: PortalWorld
let spaces: Awaited<ReturnType<typeof holdSpacesMode>>
let baseURL: string | undefined
const states = {} as Record<PortalRole, StorageState>

const inContext = (
  browser: Browser,
  options: { viewport: Viewport; role: PortalRole },
  run: (page: Page) => Promise<void>,
) => inContextAt(browser, { baseURL, viewport: options.viewport, state: states[options.role] }, run)

test.describe('portal shell', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('portal-shell') })
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    world = await portalWorld(payload, track)
    for (const role of ROLES) {
      const context = await browser.newContext({ baseURL })
      try {
        await login({
          page: await context.newPage(),
          user: world.accounts[role],
          next: '/en/spaces',
        })
        states[role] = await context.storageState()
      } finally {
        await context.close()
      }
    }
  })

  test.afterAll(async () => {
    try {
      await cleanup(payload)
    } finally {
      await spaces.release()
    }
  })

  test.describe('axe', () => {
    for (const viewport of Object.values(WIDTHS))
      for (const role of ROLES)
        for (const locale of LOCALES)
          ROUTE_SHAPES.forEach(([shape], index) =>
            test(`axe (${shape} ${role} ${locale} ${viewport.width})`, async ({ browser }) => {
              await inContext(browser, { viewport, role }, async (page) => {
                const route = portalRoutes(world, locale)[index]!
                await world.resetVisits()
                await page.goto(route)
                await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
                const counts = await axeCounts(page)
                const allowed = known(route, role, locale, viewport.width)
                const over = Object.fromEntries(
                  Object.entries(counts).filter(([id, n]) => n > (allowed[id] ?? 0)),
                )
                expect(over, `${shape} ${JSON.stringify(counts)}`).toEqual({})
              })
            }),
          )
  })
  for (const locale of LOCALES)
    for (const viewport of Object.values(WIDTHS))
      test(`a space page and a full post page have one main (${locale} ${viewport.width})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport, role: 'student' }, async (page) => {
          await page.goto(localePath(world.course.path, locale))
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
          await expect(page.getByRole('main')).toHaveCount(1)
          await page.goto(localePath(world.course.postPath, locale))
          await expect(page.getByRole('article').first()).toBeVisible()
          await expect(page.getByRole('main')).toHaveCount(1)
        })
      })
})
