import { describe, expect, it } from 'vitest'

import {
  amountsOf,
  defaultAmountOf,
  formatAmount,
  contributionLabel,
  pricingFor,
  validateContributionOptions,
} from '@/lib/pricing'

const cycle = {
  pricing: [
    {
      course_types: ['THEMATIC', 'LAB'],
      pricing: {
        options: [
          { amount: 1500, default: true },
          { amount: 2000, default: false },
        ],
      },
    },
    { course_types: ['WORKSHOP'], pricing: { options: [{ amount: 800, default: true }] } },
  ],
}

describe('pricingFor', () => {
  it("uses the cycle's price for the course type", () => {
    expect(pricingFor({ course_type: 'LAB' }, cycle)).toEqual({
      options: [
        { amount: 1500, default: true },
        { amount: 2000, default: false },
      ],
    })
    expect(pricingFor({ course_type: 'WORKSHOP' }, cycle)).toEqual({
      options: [{ amount: 800, default: true }],
    })
  })

  it("prefers the course's own override when it has options", () => {
    expect(
      pricingFor(
        { course_type: 'LAB', pricing_override: { options: [{ amount: 0, default: true }] } },
        cycle,
      ),
    ).toEqual({
      options: [{ amount: 0, default: true }],
    })
  })

  it('ignores an empty override', () => {
    expect(pricingFor({ course_type: 'LAB', pricing_override: { options: [] } }, cycle)).toEqual({
      options: [
        { amount: 1500, default: true },
        { amount: 2000, default: false },
      ],
    })
  })

  it('is null when nothing prices the course', () => {
    expect(pricingFor({ course_type: 'CORE' }, cycle)).toBeNull()
    expect(pricingFor({ course_type: 'CORE' }, null)).toBeNull()
  })
})

describe('contributionLabel', () => {
  it('shows a single price or a range with the currency after it', () => {
    expect(contributionLabel({ options: [{ amount: 800, default: true }] })).toBe('800 EGP')
    expect(
      contributionLabel({ options: [{ amount: 3500 }, { amount: 2000 }, { amount: 1500 }] }),
    ).toBe('1,500–3,500 EGP')
    expect(contributionLabel({ options: [{ amount: 0 }, { amount: 800 }] })).toBe('0–800 EGP')
  })

  it("calls a zero price free, in the caller's words", () => {
    expect(contributionLabel({ options: [{ amount: 0, default: true }] })).toBe('Free')
    expect(contributionLabel({ options: [{ amount: 0 }] }, { free: 'مجانًا' })).toBe('مجانًا')
  })

  it('is null without options', () => {
    expect(contributionLabel({ options: [] })).toBeNull()
    expect(contributionLabel(null)).toBeNull()
  })
})

describe('currency label by locale', () => {
  it.each([
    ['en', '30,000 EGP', '1,500–3,500 EGP'],
    ['ar', '٣٠٬٠٠٠ ج.م', '١٬٥٠٠–٣٬٥٠٠ ج.م'],
    ['ar-u-nu-latn', '30,000 ج.م', '1,500–3,500 ج.م'],
  ])('%s', (locale, single, range) => {
    expect(formatAmount(30000, locale)).toBe(single)
    expect(contributionLabel({ options: [{ amount: 30000 }] }, { locale })).toBe(single)
    expect(contributionLabel({ options: [{ amount: 3500 }, { amount: 1500 }] }, { locale })).toBe(
      range,
    )
  })
})

describe('contribution defaults', () => {
  it('allows unset or empty options for inheritance', () => {
    expect(validateContributionOptions(undefined)).toBe(true)
    expect(validateContributionOptions(null)).toBe(true)
    expect(validateContributionOptions([])).toBe(true)
  })

  it('requires exactly one default regardless of its position or amount', () => {
    expect(validateContributionOptions([{ default: false }, { default: true }])).toBe(true)
    expect(validateContributionOptions([{ default: true }])).toBe(true)
    expect(validateContributionOptions([{ default: false }])).not.toBe(true)
    expect(validateContributionOptions([{}, {}])).not.toBe(true)
    expect(validateContributionOptions([{ default: true }, { default: true }])).not.toBe(true)
  })
})

it('sorts unique contributions without mutating them and keeps the chosen default', () => {
  const contribution = {
    options: [{ amount: 900 }, { amount: 350, default: true }, { amount: 100 }, { amount: 350 }],
  }
  expect(amountsOf(contribution)).toEqual([100, 350, 900])
  expect(defaultAmountOf(contribution)).toBe(350)
  expect(contribution.options[0].amount).toBe(900)
  expect(amountsOf(null)).toEqual([])
  expect(defaultAmountOf(null)).toBeUndefined()
})
