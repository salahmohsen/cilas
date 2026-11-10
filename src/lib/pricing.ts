import { numberingSystemOf } from '@/lib/digits'

export const CURRENCY = 'EGP'
export const amountsOf = (contribution: Contribution | null | undefined) =>
  [...new Set(contribution?.options?.map((o) => o.amount) ?? [])].sort((a, b) => a - b)
export const defaultAmountOf = (contribution: Contribution | null | undefined) =>
  contribution?.options?.find((o) => o.default)?.amount
const formatNumber = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, { numberingSystem: numberingSystemOf(locale) }).format(n)
export const formatAmount = (n: number, locale: string) =>
  `${formatNumber(n, locale)} ${locale === 'ar' ? 'ج.م' : CURRENCY}`

export type Contribution = {
  options?: { amount: number; default?: boolean | null }[] | null
  note?: string | null
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

export const contributionLabel = (
  contribution: Contribution | null | undefined,
  display: {
    locale?: string
    amount?: (value: number) => string
    currency?: string
    free?: string
    currencyPosition?: 'before' | 'after'
  } = {},
): string | null => {
  if (!contribution?.options?.length) return null
  const amounts = amountsOf(contribution)
  const low = amounts[0]
  const high = amounts[amounts.length - 1]
  if (low === 0 && high === 0) return display.free ?? 'Free'
  const format =
    display.amount ?? ((value: number) => formatNumber(value, display.locale ?? 'en-US'))
  const range = low === high ? format(low) : `${format(low)}–${format(high)}`
  const currency = display.currency ?? CURRENCY
  return display.currencyPosition === 'after' ? `${range} ${currency}` : `${currency} ${range}`
}
