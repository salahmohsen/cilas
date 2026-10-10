import type { Field, FieldHookArgs } from 'payload'
import { describe, expect, it } from 'vitest'

import { pricingField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { computeEndDate, scheduleField } from '@/fields/schedule'
import { endAfterStart, httpUrl, notBelow, timeOfDay } from '@/fields/validators'

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
  it('is a named group with the spec fields', () => {
    const field = registrationField()
    expect(field.name).toBe('registration')
    expect(names(field.fields)).toEqual([
      'method',
      'form',
      'url',
      'deadline',
      'application_requirements',
      'archived_registration_url',
    ])
  })

  it('has no default method, so an empty one falls back to the parent', () => {
    const method = registrationField().fields.find((f) => 'name' in f && f.name === 'method')
    expect(method && 'defaultValue' in method ? method.defaultValue : undefined).toBeUndefined()
  })
})

describe('pricingField', () => {
  it('is named pricing by default, with the spec fields', () => {
    const field = pricingField()
    expect(field.name).toBe('pricing')
    expect(names(field.fields)).toEqual([
      'min',
      'max',
      'currency',
      'note',
      'need_based_deductions',
      'payment_plans',
    ])
  })

  it('takes another name, for a course override', () => {
    expect(pricingField({ name: 'pricing_override' }).name).toBe('pricing_override')
  })
})

describe('pricingField dbName', () => {
  const arrays = (field: ReturnType<typeof pricingField>) => {
    const plans = field.fields.find((f) => 'name' in f && f.name === 'payment_plans')
    if (!plans || plans.type !== 'array') throw new Error('no payment_plans')
    const items = plans.fields.find((f) => 'name' in f && f.name === 'installments')
    if (!items || items.type !== 'array') throw new Error('no installments')
    return { plans, items }
  }

  it('gives the arrays short table names when asked', () => {
    const { plans, items } = arrays(pricingField({ dbName: 'course_price' }))
    expect(plans.dbName).toBe('course_price_plans')
    expect(items.dbName).toBe('course_price_plan_items')
  })

  it('leaves them unset by default', () => {
    const { plans, items } = arrays(pricingField())
    expect(plans.dbName).toBeUndefined()
    expect(items.dbName).toBeUndefined()
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

  const max = find(pricingField().fields, 'max')

  it('max below min is rejected', () => {
    expect(check(max, 100, { min: 300 })).toMatch(/minimum/)
    expect(check(max, 500, { min: 300 })).toBe(true)
    expect(check(max, undefined, { min: 300 })).toBe(true)
  })

  it('max keeps the built-in number rules', () => {
    expect(check(max, -500, {})).not.toBe(true)
  })

  const url = find(registrationField().fields, 'url')

  it('registration url allows empty and rejects a bare domain', () => {
    expect(check(url, '', {})).toBe(true)
    expect(check(url, undefined, {})).toBe(true)
    expect(check(url, 'cilas.net', {})).toMatch(/https/)
    expect(check(url, 'https://cilas.net', {})).toBe(true)
  })
})
