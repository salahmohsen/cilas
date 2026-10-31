/** The parts of a `pricingField()` group the site reads. */
export type Pricing = {
  min?: number | null
  max?: number | null
  currency?: string | null
  need_based_deductions?: boolean | null
}

type SetPricing = Pricing & { min: number }

const isSet = (pricing: Pricing | null | undefined): pricing is SetPricing =>
  typeof pricing?.min === 'number'

/**
 * A course's price: its own override when it sets a minimum, otherwise its
 * cycle's price for its course type.
 */
export const pricingFor = (
  course: { course_type: string; pricing_override?: Pricing | null },
  cycle:
    | { pricing?: Array<{ course_types?: string[] | null; pricing?: Pricing | null }> | null }
    | null
    | undefined,
): Pricing | null => {
  if (isSet(course.pricing_override)) return course.pricing_override
  const pricing = cycle?.pricing?.find((entry) =>
    entry.course_types?.includes(course.course_type),
  )?.pricing
  return isSet(pricing) ? pricing : null
}

const amount = new Intl.NumberFormat('en-US')

/** "EGP 1,500–2,000", "EGP 800", "Free", or null when unpriced. */
export const priceLabel = (pricing: Pricing | null | undefined): string | null => {
  if (!isSet(pricing)) return null
  const { min, max } = pricing
  const hasRange = typeof max === 'number' && max > min
  if (min === 0 && !hasRange) return 'Free'
  const range = hasRange ? `${amount.format(min)}–${amount.format(max)}` : amount.format(min)
  return `${pricing.currency ?? 'EGP'} ${range}`
}
