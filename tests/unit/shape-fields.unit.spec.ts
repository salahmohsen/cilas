import type { Field, FieldHookArgs } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { bibliographyField } from '@/fields/bibliography'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { CREDIT_ROLES, creditsField } from '@/fields/credits'
import { importFields } from '@/fields/import'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { contributionField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { computeEndDate, scheduleField, timeRangeFields } from '@/fields/schedule'
import { endAfterStart, httpUrl, notBelow, timeOfDay } from '@/fields/validators'
import { sessionsInOrder } from '@/lib/schedule'

describe('validators', () => {
  it('timeOfDay accepts 24-hour HH:MM only', () => {
    expect(timeOfDay('19:00')).toBe(true)
    expect(timeOfDay('00:05')).toBe(true)
    expect(timeOfDay('7:00')).toMatch(/HH:MM/)
    expect(timeOfDay('24:00')).toMatch(/HH:MM/)
    expect(timeOfDay('7pm')).toMatch(/HH:MM/)
    expect(timeOfDay(null)).toMatch(/HH:MM/)
  })

  it('endAfterStart needs the end strictly later', () => {
    expect(endAfterStart('21:00', '19:00')).toBe(true)
    expect(endAfterStart('19:00', '19:00')).toMatch(/after/)
    expect(endAfterStart('18:00', '19:00')).toMatch(/after/)
    // An invalid end is reported by timeOfDay; an unset start can't be compared.
    expect(endAfterStart('21:00', undefined)).toBe(true)
  })

  it('notBelow allows an empty or larger value', () => {
    expect(notBelow(500, 300, 'the minimum')).toBe(true)
    expect(notBelow(300, 300, 'the minimum')).toBe(true)
    expect(notBelow(null, 300, 'the minimum')).toBe(true)
    expect(notBelow(100, 300, 'the minimum')).toBe('Must not be below the minimum.')
  })

  it('httpUrl still lives here', () => {
    expect(httpUrl('https://cilas.net')).toBe(true)
    expect(httpUrl('cilas.net')).toMatch(/https/)
  })
})

// Names of the data fields directly inside a group, looking through rows.
const names = (fields: Field[]): string[] =>
  fields.flatMap((f) => ('name' in f ? [f.name] : 'fields' in f ? names(f.fields) : []))

describe('scheduleField', () => {
  it('is a named group with the spec fields', () => {
    const field = scheduleField()
    expect(field.name).toBe('schedule')
    expect(names(field.fields)).toEqual([
      'start_date',
      'start_precision',
      'weeks',
      'slots',
      'end_date',
      'note',
    ])
  })

  it('computes end_date from its sibling pattern', () => {
    const siblingData = {
      start_date: '2026-03-03',
      weeks: 2,
      slots: [{ weekday: 'tue', start_time: '19:00', end_time: '21:00' }],
    }
    expect(computeEndDate({ siblingData } as unknown as FieldHookArgs)).toBe('2026-03-10')
    expect(computeEndDate({ siblingData: {} } as unknown as FieldHookArgs)).toBeNull()
  })
})

describe('registrationField', () => {
  const validate = (args: Partial<FieldHookArgs>) => {
    const hook = registrationField().hooks!.beforeChange![0]
    return hook(args as FieldHookArgs)
  }

  it('validates an inherited destination with the same request and access checks', async () => {
    const findByID = vi.fn().mockResolvedValue({ registration: { method: 'form', form: 7 } })
    const req = { payload: { findByID } } as unknown as FieldHookArgs['req']
    await expect(
      validate({
        value: {},
        data: { cycle: 3, _status: 'published' },
        collection: { slug: 'courses' } as FieldHookArgs['collection'],
        req,
        operation: 'create',
      }),
    ).resolves.toEqual({})
    expect(findByID).toHaveBeenCalledWith({
      collection: 'cycles',
      id: 3,
      depth: 0,
      req,
      overrideAccess: false,
    })
  })

  it('rejects a missing site form even after the deadline', async () => {
    await expect(
      validate({
        value: { method: 'form', deadline: '2000-01-01' },
        data: { _status: 'published' },
        req: {} as FieldHookArgs['req'],
        operation: 'create',
      }),
    ).rejects.toThrow()
  })

  it('rejects an invalid inherited external URL', async () => {
    const findByID = vi
      .fn()
      .mockResolvedValue({ registration: { method: 'external', url: 'javascript:alert(1)' } })
    await expect(
      validate({
        value: {},
        data: { cycle: 3, _status: 'published' },
        collection: { slug: 'courses' } as FieldHookArgs['collection'],
        req: { payload: { findByID } } as unknown as FieldHookArgs['req'],
        operation: 'create',
      }),
    ).rejects.toThrow()
  })

  it('lets an unsubmitted draft keep an incomplete destination', async () => {
    await expect(
      validate({ value: { method: 'form' }, data: { _status: 'draft' } }),
    ).resolves.toEqual({ method: 'form' })
  })
})

describe('contributionField payment plans', () => {
  it('exposes payment plans only when explicitly enabled', () => {
    expect(names(contributionField().fields)).not.toContain('payment_plans')
    expect(names(contributionField({ paymentPlans: true }).fields)).toContain('payment_plans')
  })
})

describe('contributionField dbName', () => {
  const arrays = (field: ReturnType<typeof contributionField>) => {
    const plans = field.fields.find((f) => 'name' in f && f.name === 'payment_plans')
    if (!plans || plans.type !== 'array') throw new Error('no payment_plans')
    const items = plans.fields.find((f) => 'name' in f && f.name === 'installments')
    if (!items || items.type !== 'array') throw new Error('no installments')
    return { plans, items }
  }

  it('gives the arrays short table names when asked', () => {
    const { plans, items } = arrays(
      contributionField({ dbName: 'programme_price', paymentPlans: true }),
    )
    expect(plans.dbName).toBe('programme_price_plans')
    expect(items.dbName).toBe('programme_price_plan_items')
  })
})

describe('computeEndDate on update', () => {
  const previousSiblingDoc = {
    start_date: '2026-03-03',
    weeks: 2,
    slots: [{ weekday: 'tue', start_time: '19:00', end_time: '21:00' }],
  }
  const run = (args: Record<string, unknown>) => computeEndDate(args as unknown as FieldHookArgs)

  it('keeps the date on a partial update', () => {
    expect(run({ siblingData: {}, previousSiblingDoc })).toBe('2026-03-10')
  })

  it('lets new values override the stored ones', () => {
    expect(run({ siblingData: { weeks: 3 }, previousSiblingDoc })).toBe('2026-03-17')
  })

  it('skips a cancelled last session from data.sessions', () => {
    const data = {
      sessions: [
        { order: 1, meetings: 1 },
        { order: 2, meetings: 1, cancelled: true },
      ],
    }
    expect(run({ siblingData: {}, previousSiblingDoc, data })).toBe('2026-03-03')
  })

  it('falls back to originalDoc.sessions when data has none', () => {
    const originalDoc = {
      sessions: [
        { order: 1, meetings: 1 },
        { order: 2, meetings: 1, cancelled: true },
      ],
    }
    expect(run({ siblingData: {}, previousSiblingDoc, data: {}, originalDoc })).toBe('2026-03-03')
  })
})

describe('validate closures in the configs', () => {
  // Mirrors how Payload calls validate: the field's own config plus siblingData and req.
  const req = {
    payload: { config: {} },
    t: (key: string) => key,
  }
  const find = (fields: Field[], name: string): Field | undefined => {
    for (const f of fields) {
      if ('name' in f && f.name === name) return f
      if (!('name' in f) && 'fields' in f) {
        const hit = find(f.fields, name)
        if (hit) return hit
      }
    }
    return undefined
  }
  const check = (
    field: Field | undefined,
    value: unknown,
    siblingData: Record<string, unknown>,
  ) => {
    if (!field || !('validate' in field) || typeof field.validate !== 'function') {
      throw new Error('field has no validate')
    }
    const validate = field.validate as (v: unknown, o: unknown) => unknown
    return validate(value, { ...field, siblingData, req })
  }

  const slots = find(scheduleField().fields, 'slots')
  const endTime = find(slots && 'fields' in slots ? slots.fields : [], 'end_time')

  it('end_time rejects an end before the start', () => {
    expect(check(endTime, '18:00', { start_time: '19:00' })).toMatch(/after/)
  })

  it('end_time rejects a bad format and a missing value', () => {
    expect(check(endTime, '9pm', { start_time: '19:00' })).toMatch(/HH:MM/)
    expect(check(endTime, '', { start_time: '19:00' })).not.toBe(true)
  })

  it('end_time accepts a valid later time', () => {
    expect(check(endTime, '21:00', { start_time: '19:00' })).toBe(true)
  })

  const contributionOptions = find(contributionField().fields, 'options')
  it('validates contribution defaults through the configured field', async () => {
    await expect(check(contributionOptions, [], {})).resolves.toBe(true)
    await expect(check(contributionOptions, [{ amount: 0, default: true }], {})).resolves.toBe(true)
    await expect(
      check(contributionOptions, [{ amount: 800, default: false }], {}),
    ).resolves.not.toBe(true)
    await expect(
      check(
        contributionOptions,
        [
          { amount: 0, default: true },
          { amount: 800, default: true },
        ],
        {},
      ),
    ).resolves.not.toBe(true)
  })

  const url = find(registrationField().fields, 'url')

  it('registration url allows empty and rejects a bare domain', () => {
    expect(check(url, '', {})).toBe(true)
    expect(check(url, undefined, {})).toBe(true)
    expect(check(url, 'cilas.net', {})).toMatch(/https/)
    expect(check(url, 'https://cilas.net', {})).toBe(true)
  })
})

describe('shared field pieces', () => {
  it('lists the five course types', () => {
    expect(COURSE_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'CORE',
      'THEMATIC',
      'LAB',
      'WORKSHOP',
      'SHORT',
    ])
  })

  it('builds a bibliography array of materials', () => {
    const field = bibliographyField()
    expect(field.name).toBe('bibliography')
    expect(names(field.fields)).toEqual(['type', 'title', 'href', 'note'])
  })

  it('shares start and end time fields', () => {
    expect(names(timeRangeFields())).toEqual(['start_time', 'end_time'])
  })

  it('orders sessions the same way expandSchedule numbers them', () => {
    expect(sessionsInOrder([{ order: 2 }, {}, { order: 1 }])).toEqual([
      { order: 1 },
      { order: 2 },
      {},
    ])
  })
})

describe('credits and language', () => {
  it('builds credits as role, label and people', () => {
    const field = creditsField()
    expect(field.name).toBe('credits')
    expect(names(field.fields)).toEqual(['role', 'label', 'people'])
  })

  it('covers the roles the archive credits', () => {
    expect(CREDIT_ROLES).toEqual([
      'author',
      'editor',
      'translator',
      'copy_editor',
      'proofreader',
      'supervisor',
      'coordinator',
      'art_director',
      'cover_designer',
      'illustrator',
      'photographer',
      'other',
    ])
  })

  it('lists the languages content comes in', () => {
    expect(LANGUAGE_OPTIONS.map((o) => o.value)).toEqual(['ar', 'en', 'de', 'fr', 'other'])
  })
})

describe('importFields', () => {
  it('adds a hidden, unique legacy URL and nothing else', () => {
    const fields = importFields()
    expect(names(fields)).toEqual(['legacy_url'])
    expect(fields[0]).toMatchObject({
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true },
    })
  })
})
