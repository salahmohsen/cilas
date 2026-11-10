import { formatPhoneNumber } from '@/lib/phone'

type Option = { label?: string | null; value?: string | null }
type Question = { blockType?: string; name?: string | null; options?: readonly Option[] | null }

/**
 * A saved answer as people read it: each option value becomes its option's
 * current label. A checkbox group saves its values joined by ", ". A value
 * no option has any more, or an older answer saved as label text, shows as
 * it was saved.
 */
export const answerText = (question: Question | undefined, value: string): string => {
  if (question?.blockType === 'phone') return formatPhoneNumber(value)
  const labels = new Map(
    (question?.options ?? []).flatMap((o) => (o.value ? [[o.value, o.label || o.value]] : [])),
  )
  if (!labels.size || !value) return value
  return (
    labels.get(value) ??
    value
      .split(', ')
      .map((v) => labels.get(v) ?? v)
      .join(', ')
  )
}

export const answerTexts = (questions: readonly unknown[] | null | undefined) => {
  const byName = new Map(
    ((questions ?? []) as Question[]).flatMap((q) => (q.name ? [[q.name, q]] : [])),
  )
  return (name: string, value: string) => answerText(byName.get(name), value)
}
