import { numberingSystemOf } from '@/lib/digits'

/** ISO 4217 code, for machine-readable data. People read `formatAmount`. */
export const CURRENCY = 'EGP'
export const amountsOf = (contribution: Contribution | null | undefined) =>
  [...new Set(contribution?.options?.map((o) => o.amount) ?? [])].sort((a, b) => a - b)
export const defaultAmountOf = (contribution: Contribution | null | undefined) =>
  contribution?.options?.find((o) => o.default)?.amount
const formatNumber = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, { numberingSystem: numberingSystemOf(locale) }).format(n)
const currencyLabel = (locale: string) => (locale.startsWith('ar') ? 'ج.م' : CURRENCY)
const withCurrency = (amount: string, locale: string) => `${amount} ${currencyLabel(locale)}`
export const formatAmount = (n: number, locale: string) =>
  withCurrency(formatNumber(n, locale), locale)

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
  { locale = 'en', free = 'Free' }: { locale?: string; free?: string } = {},
): string | null => {
  if (!contribution?.options?.length) return null
  const amounts = amountsOf(contribution)
  const low = amounts[0]
  const high = amounts[amounts.length - 1]
  if (low === 0 && high === 0) return free
  const range =
    low === high
      ? formatNumber(low, locale)
      : `${formatNumber(low, locale)}–${formatNumber(high, locale)}`
  return withCurrency(range, locale)
}
