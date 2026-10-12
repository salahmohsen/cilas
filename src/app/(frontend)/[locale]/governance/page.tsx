import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import type { Locale } from '@/api/articles.api'
import { getGovernance } from '@/api/people.api'
import { PeoplePage } from '@/components/person/people-page'

type Props = { params: Promise<{ locale: string }> }

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Governance')
  return { title: t('metaTitle'), description: t('intro') }
}

/** The advisors and trustees on a wheel. */
export default async function GovernancePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Governance')
  const members = await getGovernance(await getPayload({ config }), (locale === 'ar' ? 'ar' : 'en') as Locale)
  const term = (from: number | null, to: number | null) =>
    from ? (to ? `${from}–${to}` : t('since', { year: from })) : null

  return (
    <PeoplePage
      count={t('count', { count: members.length })}
      intro={t('intro')}
      namespace="Governance"
      people={members.map((m) => ({
        ...m,
        eyebrow: t(`roles.${m.role}`),
        lines: [
          ...(m.title ? [{ key: 'title', title: m.title }] : []),
          ...(m.boardRole ? [{ key: 'board', title: m.boardRole, sub: t('board') }] : []),
          ...(m.advisesOn ? [{ key: 'advises', title: m.advisesOn, sub: t('advisesOn') }] : []),
          ...(term(m.termFrom, m.termTo) ? [{ key: 'term', title: term(m.termFrom, m.termTo)!, sub: t('term') }] : []),
        ],
      }))}
      title={t('title')}
    />
  )
}
