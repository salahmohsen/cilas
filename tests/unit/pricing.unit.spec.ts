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
  it('shows a single price or a range in EGP', () => {
    expect(contributionLabel({ options: [{ amount: 800, default: true }] })).toBe('EGP 800')
    expect(
      contributionLabel({
        options: [
          { amount: 1500, default: true },
          { amount: 2000, default: false },
        ],
      }),
    ).toBe('EGP 1,500–2,000')
    expect(
      contributionLabel({
        options: [
          { amount: 1500, default: true },
          { amount: 1500, default: false },
        ],
      }),
    ).toBe('EGP 1,500')
  })

  it('calls a zero price free', () => {
    expect(contributionLabel({ options: [{ amount: 0, default: true }] })).toBe('Free')
  })

  it('is null without options', () => {
    expect(contributionLabel({ options: [] })).toBeNull()
    expect(contributionLabel(null)).toBeNull()
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

it('labels unsorted options by their extrema and preserves localized words', () => {
  const contribution = { options: [{ amount: 3500 }, { amount: 2000 }, { amount: 1500 }] }
  expect(contributionLabel(contribution)).toBe('EGP 1,500–3,500')
  expect(contributionLabel({ options: [{ amount: 0 }, { amount: 800 }] })).toBe('EGP 0–800')
  expect(contributionLabel({ options: [{ amount: 0 }] }, { free: 'مجاني' })).toBe('مجاني')
  expect(contributionLabel(contribution, { currency: 'ج.م', currencyPosition: 'after' })).toBe(
    '1,500–3,500 ج.م',
  )
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
it('formats Arabic money and the Bridge contribution with Arabic digits', () => {
  expect(formatAmount(30000, 'ar')).toBe('٣٠٬٠٠٠ ج.م')
  expect(formatAmount(30000, 'en')).toBe('30,000 EGP')
  expect(contributionLabel({ options: [{ amount: 30000, default: true }] }, { locale: 'ar' })).toBe(
    'EGP ٣٠٬٠٠٠',
  )
})
