import { describe, expect, it } from 'vitest'

import { registrationStatus } from '@/lib/registration'

// 23:30 on 1 March in Cairo, then 00:30 on 2 March.
const lateOnDeadline = new Date('2026-03-01T21:30:00Z')
const dayAfter = new Date('2026-03-01T22:30:00Z')

describe('registrationStatus', () => {
  it('is open through the end of the deadline day in Cairo', () => {
    const reg = { method: 'form' as const, deadline: '2026-03-01' }
    expect(registrationStatus(reg, null, lateOnDeadline)).toBe('open')
    expect(registrationStatus(reg, null, dayAfter)).toBe('closed')
  })

  it('reads a stored deadline timestamp as its Cairo day', () => {
    const reg = { method: 'external' as const, deadline: '2026-02-28T22:00:00.000Z' }
    expect(registrationStatus(reg, null, lateOnDeadline)).toBe('open')
  })

  it('is open with a method and no deadline', () => {
    expect(registrationStatus({ method: 'form' }, null, dayAfter)).toBe('open')
  })

  it('is closed when the method is closed, whatever the deadline', () => {
    expect(registrationStatus({ method: 'closed', deadline: '2099-01-01' }, null)).toBe('closed')
  })

  it('is closed when nothing is set', () => {
    expect(registrationStatus(null, null)).toBe('closed')
    expect(registrationStatus({}, {})).toBe('closed')
  })

  it("falls back to the cycle's method and deadline", () => {
    const cycle = { method: 'form' as const, deadline: '2026-03-01' }
    expect(registrationStatus({}, cycle, lateOnDeadline)).toBe('open')
    expect(registrationStatus({}, cycle, dayAfter)).toBe('closed')
  })

  it("prefers the course's own deadline", () => {
    const cycle = { method: 'form' as const, deadline: '2026-02-01' }
    expect(registrationStatus({ deadline: '2026-03-01' }, cycle, lateOnDeadline)).toBe('open')
  })

  it('lets a course close even when its cycle is open', () => {
    const cycle = { method: 'form' as const }
    expect(registrationStatus({ method: 'closed' }, cycle)).toBe('closed')
  })

  it('treats an invalid deadline as absent', () => {
    expect(registrationStatus({ method: 'form', deadline: 'nope' }, null, dayAfter)).toBe('open')
  })
})
