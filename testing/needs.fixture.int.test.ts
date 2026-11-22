import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { latestRows } from '@/portal/needs/latest'
import { workSetsOf } from '@/portal/needs/needs'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from './local-services.test-utils'
import { mockNetwork } from './msw-node.test-utils'
import { portalNeedsWorld, STUDENT_NOTIFICATIONS, type PortalNeedsWorld } from './needs.fixture'
import { createTracker } from './payload.fixture'
import type { PortalAccount } from './portal.fixture'
import { resendInbox } from './resend.test-utils'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('portalNeedsWorld', () => {
  let world: PortalNeedsWorld

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    world = await portalNeedsWorld(payload, track)
  }, 300_000)

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  const userOf = async (account: PortalAccount) =>
    (await payload.findByID({
      collection: 'users',
      id: account.id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as User

  const notesOf = async (account: PortalAccount) =>
    (
      await payload.find({
        collection: 'notifications',
        where: { recipient: { equals: account.id } },
        sort: 'createdAt',
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
    ).docs

  it('gives the student two owner rows, the fellow at least one, and the student 35 notifications', async () => {
    const student = await workSetsOf(payload, await userOf(world.world.accounts.student))
    expect(student.ownArticles?.size).toBeGreaterThanOrEqual(2)
    const fellow = await workSetsOf(payload, await userOf(world.world.accounts.fellow))
    expect(fellow.ownCourses?.size).toBeGreaterThanOrEqual(1)
    const notes = await notesOf(world.world.accounts.student)
    expect(notes).toHaveLength(STUDENT_NOTIFICATIONS)
    expect(new Set(notes.map((note) => note.link))).toEqual(new Set([world.link]))
    const times = notes.map((note) => note.createdAt)
    expect(times).toEqual([...times].sort())
  })

  it('gives the admin and the fellow one post link each, and a second admin with no rows of its own', async () => {
    for (const role of ['admin', 'fellow'] as const)
      expect(await notesOf(world.world.accounts[role])).toHaveLength(1)
    expect(world.secondAdmin.id).not.toBe(world.world.accounts.admin.id)
    expect(await notesOf(world.secondAdmin)).toHaveLength(0)
  })

  it('takes the newest IDs first when notification timestamps tie across the page limit', async () => {
    const account = world.world.accounts.student
    const notes = await notesOf(account)
    const createdAt = '2026-01-01T00:00:00.000Z'
    for (const { id } of notes) {
      await payload.db.updateOne({ collection: 'notifications', id, data: { createdAt } })
    }
    expect(new Set((await notesOf(account)).map((note) => note.createdAt))).toEqual(
      new Set([createdAt]),
    )

    const result = await latestRows(payload, await userOf(account), 1)
    expect(result.rows.map(({ id }) => id)).toEqual(
      notes
        .map(({ id }) => id)
        .sort((a, b) => b - a)
        .slice(0, 30),
    )
    expect(result.more).toBe('link')
  })
})
