// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import { createTracker, uniq } from './fixtures'

const { track, cleanup } = createTracker()
let payload: Payload
let fellow: User
let courseId: number
let cycleId: number

describe('course registration and fellow fields', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    const person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: uniq('Fellow'), slug: uniq('fellow') },
      }),
    )
    fellow = {
      ...track(
        'users',
        await payload.create({
          collection: 'users',
          data: {
            email: `${uniq('fellow')}@cilas.test`,
            password: 'Test-password-123!',
            roles: ['fellow'],
            person: person.id,
          },
        }),
      ),
      collection: 'users',
    } as User
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: uniq('Place'), slug: uniq('place'), city: uniq('City') },
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: {
          season: 'fall',
          start_year: 2099,
          place: place.id,
          registration: { method: 'external', url: 'https://example.org/cycle' },
        },
      }),
    )
    cycleId = cycle.id
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        draft: true,
        overrideAccess: false,
        user: fellow,
        data: { title: uniq('Draft course'), slug: uniq('draft-course'), course_type: 'CORE' },
      }),
    )
    courseId = course.id
    expect(course.cycle).toBeFalsy()
  })
  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  it('saves a fellow draft without a cycle, but refuses publication and approval without one', async () => {
    for (const data of [
      { _status: 'published' as const },
      { review: { status: 'approved' as const } },
    ]) {
      await expect(payload.update({ collection: 'courses', id: courseId, data })).rejects.toThrow(
        /cycle/i,
      )
    }
    const saved = await payload.update({
      collection: 'courses',
      id: courseId,
      draft: true,
      overrideAccess: false,
      user: fellow,
      data: { summary: 'Updated draft' },
    })
    expect(saved.summary).toBe('Updated draft')
  })

  it('discards fellow writes to cycle, registration and contribution on create and update', async () => {
    const blocked = {
      cycle: cycleId,
      registration: {
        mode: 'own' as const,
        method: 'external' as const,
        url: 'https://example.org/fellow',
      },
      pricing_override: { options: [{ amount: 999, default: true }] },
    }
    const created = track(
      'courses',
      await payload.create({
        collection: 'courses',
        draft: true,
        overrideAccess: false,
        user: fellow,
        data: {
          title: uniq('Protected'),
          slug: uniq('protected'),
          course_type: 'CORE',
          ...blocked,
        },
      }),
    )
    expect(created.cycle).toBeFalsy()
    expect(created.registration?.mode).not.toBe('own')
    expect(created.pricing_override?.options?.length ?? 0).toBe(0)
    const adminSaved = await payload.update({
      collection: 'courses',
      id: courseId,
      draft: true,
      data: {
        cycle: cycleId,
        registration: { mode: 'closed' },
        pricing_override: { options: [{ amount: 50, default: true }] },
      },
    })
    const updated = await payload.update({
      collection: 'courses',
      id: courseId,
      draft: true,
      overrideAccess: false,
      user: fellow,
      depth: 0,
      data: {
        ...blocked,
        cycle: null,
        summary: 'Fellow can edit',
        applicant_questions: [{ blockType: 'text', name: 'interest', label: 'Your interest' }],
      },
    })
    expect(updated.cycle).toBe(cycleId)
    expect(updated.registration).toEqual(adminSaved.registration)
    expect(updated.pricing_override?.options?.map(({ amount }) => amount)).toEqual([50])
    expect(updated.applicant_questions?.[0]).toMatchObject({ name: 'interest' })
    expect(updated.summary).toBe('Fellow can edit')
  })

  it('publishes follow_cycle with an external cycle and own external without site form questions', async () => {
    for (const registration of [
      { mode: 'own' as const, method: 'form' as const, form: null },
      { mode: 'own' as const, method: 'external' as const, url: null },
      { mode: 'own' as const, method: 'external' as const, url: 'javascript:alert(1)' },
    ]) {
      await expect(
        payload.update({
          collection: 'courses',
          id: courseId,
          data: { cycle: cycleId, registration, _status: 'published' },
        }),
      ).rejects.toThrow()
    }
    const published = await payload.update({
      collection: 'courses',
      id: courseId,
      data: {
        cycle: cycleId,
        tier: 'public',
        registration: { mode: 'follow_cycle' },
        _status: 'published',
      },
    })
    expect(published._status).toBe('published')
    const own = await payload.update({
      collection: 'courses',
      id: courseId,
      data: {
        registration: { mode: 'own', method: 'external', url: 'https://example.org/apply' },
        applicant_questions: [{ blockType: 'text', name: 'unused' }],
        _status: 'published',
      },
    })
    expect(own.registration?.url).toBe('https://example.org/apply')
  })
})
