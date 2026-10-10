import { describe, expect, it } from 'vitest'

import { priceLabel, pricingFor } from '@/lib/pricing'

const cycle = {
  pricing: [
    { course_types: ['THEMATIC', 'LAB'], pricing: { min: 1500, max: 2000 } },
    { course_types: ['WORKSHOP'], pricing: { min: 800 } },
  ],
}

describe('pricingFor', () => {
  it("uses the cycle's price for the course type", () => {
    expect(pricingFor({ course_type: 'LAB' }, cycle)).toEqual({ min: 1500, max: 2000 })
    expect(pricingFor({ course_type: 'WORKSHOP' }, cycle)).toEqual({ min: 800 })
  })

  it("prefers the course's own override when it has a minimum", () => {
    expect(pricingFor({ course_type: 'LAB', pricing_override: { min: 0 } }, cycle)).toEqual({
      min: 0,
    })
  })

  it('ignores an empty override', () => {
    expect(pricingFor({ course_type: 'LAB', pricing_override: { min: null } }, cycle)).toEqual({
      min: 1500,
      max: 2000,
    })
  })

  it('is null when nothing prices the course', () => {
    expect(pricingFor({ course_type: 'CORE' }, cycle)).toBeNull()
    expect(pricingFor({ course_type: 'CORE' }, null)).toBeNull()
  })
})

describe('priceLabel', () => {
  it('shows a single price or a range in EGP', () => {
    expect(priceLabel({ min: 800 })).toBe('EGP 800')
    expect(priceLabel({ min: 1500, max: 2000 })).toBe('EGP 1,500–2,000')
    expect(priceLabel({ min: 1500, max: 1500 })).toBe('EGP 1,500')
  })

  it('calls a zero price free', () => {
    expect(priceLabel({ min: 0 })).toBe('Free')
  })

  it('is null without a minimum', () => {
    expect(priceLabel({ min: null })).toBeNull()
    expect(priceLabel(null)).toBeNull()
  })
})
