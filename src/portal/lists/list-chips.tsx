import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import type { Locale } from '@/i18n/routing'

import { CHIPS } from './groups'
import { hrefOf, type ListParams } from './list-params'
import styles from './lists.module.css'

const ALL_THEN_CHIPS = [null, ...CHIPS] as const

/**
 * The filter chips: links, because the filter is in the URL. The current
 * chip has `aria-current="true"`. A chip keeps the search and drops the
 * Show more focus and the page counts, as the search form does.
 */
export async function ListChips({
  params,
  path,
  locale,
}: {
  params: ListParams
  path: string
  locale: Locale
}): Promise<React.JSX.Element> {
  const t = await getTranslations('Portal')
  return (
    <nav aria-label={t('lists.chips.label')} className={styles.chips}>
      {ALL_THEN_CHIPS.map((show) => (
        <Link
          key={show ?? 'all'}
          href={hrefOf(path, { ...params, show, pages: {}, focus: null }, locale)}
          className={styles.chip}
          aria-current={params.show === show ? 'true' : undefined}
        >
          {t(`lists.chips.${show ?? 'all'}`)}
        </Link>
      ))}
    </nav>
  )
}
