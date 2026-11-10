export type Contribution = {
  options?: { amount: number; default?: boolean | null }[] | null
  note?: string | null
  currency?: 'EGP' | null
  need_based_deductions?: boolean | null
}

export const validateContributionOptions = (options: unknown[] | null | undefined): true | string =>
  !options?.length ||
  options.filter(
    (option) =>
      typeof option === 'object' &&
      option !== null &&
      'default' in option &&
      option.default === true,
  ).length === 1
    ? true
    : 'Choose exactly one default contribution amount.'

export const pricingFor = (
  course: { course_type: string; pricing_override?: Contribution | null },
  cycle:
    | { pricing?: Array<{ course_types?: string[] | null; pricing?: Contribution | null }> | null }
    | null
    | undefined,
): Contribution | null => {
  if (course.pricing_override?.options?.length) return course.pricing_override
  const pricing = cycle?.pricing?.find((entry) =>
    entry.course_types?.includes(course.course_type),
  )?.pricing
  return pricing?.options?.length ? pricing : null
}

const amount = new Intl.NumberFormat('en-US')

export const contributionLabel = (
  contribution: Contribution | null | undefined,
  display: {
    amount?: (value: number) => string
    currency?: string
    free?: string
    currencyPosition?: 'before' | 'after'
  } = {},
): string | null => {
  if (!contribution?.options?.length) return null
  const amounts = contribution.options.map((option) => option.amount)
  const low = Math.min(...amounts)
  const high = Math.max(...amounts)
  if (low === 0 && high === 0) return display.free ?? 'Free'
  const format = display.amount ?? ((value: number) => amount.format(value))
  const range = low === high ? format(low) : `${format(low)}–${format(high)}`
  const currency = display.currency ?? 'EGP'
  return display.currencyPosition === 'after' ? `${range} ${currency}` : `${currency} ${range}`
}
