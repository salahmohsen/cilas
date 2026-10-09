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
