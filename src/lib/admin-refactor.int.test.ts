// @vitest-environment node
import { createLocalReq, getPayload, type Payload } from 'payload'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { down as removeEventDrafts } from '@/migrations/20261029_075239_event_drafts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import { expandSchedule } from '@/lib/schedule'
import { getEventPreview } from '@/lib/event-preview'
import { getPublicEvent } from '@/api/events.api'

describe('admin event timing and validation', () => {
  let payload: Payload
  const ids: number[] = []
  const courses: number[] = []
  beforeAll(async () => {
    payload = await getPayload({ config })
  })
  afterAll(async () => {
    for (const id of ids) await payload.delete({ collection: 'events', id })
    for (const id of courses) await payload.delete({ collection: 'courses', id })
    await payload.destroy()
  })
  const event = () => ({
    _status: 'published' as const,
    tier: 'owner' as const,
    title: 'Screening validation',
    event_type: 'screening' as const,
    slug: `admin-screening-${crypto.randomUUID()}`,
  })

  it('saves one event time with no agenda or recurrence configuration', async () => {
    const doc = await payload.create({
      collection: 'events',
      data: {
        ...event(),
        schedule: {
          mode: 'single',
          start_date: '2026-10-30',
          start_time: '19:00',
          end_time: '21:00',
        },
      },
    })
    ids.push(doc.id)
    expect(doc.agenda ?? []).toEqual([])
    expect(doc.schedule?.end_date).toContain('2026-10-30')
    expect(doc.schedule?.start_time).toBe('19:00')
    const changed = await payload.update({
      collection: 'events',
      id: doc.id,
      data: { schedule: { end_time: '22:00' } },
    })
    expect(changed.schedule?.start_time).toBe('19:00')
    expect(changed.schedule?.end_time).toBe('22:00')
  })

  it('rejects a half-entered time range at the API boundary', async () => {
    await expect(
      payload.create({
        collection: 'events',
        data: {
          ...event(),
          schedule: { mode: 'single', start_date: '2026-10-30', start_time: '19:00' },
        },
      }),
    ).rejects.toThrow()
  })

  it('preserves legacy callers that create a recurring schedule without a mode', async () => {
    const doc = await payload.create({
      collection: 'events',
      data: {
        ...event(),
        schedule: {
          start_date: '2026-11-04',
          weeks: 2,
          slots: [{ weekday: 'wed', start_time: '19:00', end_time: '21:00' }],
        },
      },
    })
    ids.push(doc.id)
    expect(expandSchedule(doc.schedule)).toHaveLength(2)
  })

  it('requires the selected external registration destination', async () => {
    await expect(
      payload
        .create({
          collection: 'events',
          data: {
            ...event(),
            registration: { method: 'external' },
          },
        })
        .then((doc) => {
          ids.push(doc.id)
          return doc
        }),
    ).rejects.toThrow()
  })

  it('does not let a member change Site Settings through the Local API', async () => {
    await expect(
      payload.updateGlobal({
        slug: 'site-settings',
        data: {},
        user: { id: -1, collection: 'users', roles: ['member'] } as User,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('allows a course proposal before its cycle or course type is chosen', async () => {
    const doc = await payload.create({
      collection: 'courses',
      draft: true,
      data: {
        title: 'Unassigned proposal',
        slug: `admin-proposal-${crypto.randomUUID()}`,
      },
    })
    courses.push(doc.id)
    expect(doc._status).toBe('draft')
    expect(doc.cycle).toBeFalsy()
    expect(doc.course_type).toBeFalsy()
    await expect(
      payload.update({ collection: 'courses', id: doc.id, data: { _status: 'published' } }),
    ).rejects.toThrow()
  })

  it('keeps the published event unchanged while an admin edits a draft', async () => {
    const doc = await payload.create({
      collection: 'events',
      data: {
        ...event(),
        tier: 'public',
        _status: 'published',
      },
    })
    ids.push(doc.id)
    await payload.update({
      collection: 'events',
      id: doc.id,
      draft: true,
      data: { title: 'Unapproved screening change' },
    })
    const live = await payload.findByID({ collection: 'events', id: doc.id, overrideAccess: false })
    expect(live.title).toBe('Screening validation')
    const draft = await payload.findByID({ collection: 'events', id: doc.id, draft: true })
    expect(draft.title).toBe('Unapproved screening change')
    const admin = { id: -2, collection: 'users', roles: ['admin'] } as User
    expect((await getEventPreview(payload, doc.id, 'en', admin))?.title).toBe(
      'Unapproved screening change',
    )
    for (const user of [null, { id: -3, collection: 'users', roles: ['member'] } as User]) {
      expect(await getEventPreview(payload, doc.id, 'en', user)).toBeNull()
    }
  })

  it('keeps a public-tier draft out of public listings and denies its versions to members', async () => {
    const doc = await payload.create({
      collection: 'events',
      draft: true,
      data: { ...event(), _status: 'draft', tier: 'public' },
    })
    ids.push(doc.id)
    expect(await getPublicEvent(payload, 'en', doc.slug!)).toBeUndefined()
    await expect(
      payload.findVersions({
        collection: 'events',
        overrideAccess: false,
        user: { id: -3, collection: 'users', roles: ['member'] } as User,
      }),
    ).rejects.toThrow()
  })

  it('refuses a downgrade that would expose an unpublished public-tier event', async () => {
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error('Rollback test requires a database transaction')
    const sessions = payload.db.sessions as PostgresAdapter['sessions']
    const req = await createLocalReq({}, payload)
    req.transactionID = transactionID
    try {
      await payload.create({
        collection: 'events',
        draft: true,
        req,
        data: { ...event(), tier: 'public', _status: 'draft' },
      })
      await expect(removeEventDrafts({ db: sessions[transactionID].db })).rejects.toThrow()
    } finally {
      await payload.db.rollbackTransaction(transactionID)
    }
  })
})
