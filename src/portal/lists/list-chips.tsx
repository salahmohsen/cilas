import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import type { Locale } from '@/i18n/routing'

import type { Chip } from './groups'
import { hrefOf, type ListParams } from './list-params'
import styles from './lists.module.css'

const CHIPS: readonly (Chip | null)[] = [null, 'needsYou', 'drafts', 'published']

/**
 * The filter chips: links, because the filter is in the URL. The current
 * chip has `aria-current="true"`. A chip keeps the search and drops the
 * Show more focus.
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
      {CHIPS.map((show) => (
        <Link
          key={show ?? 'all'}
          href={hrefOf(path, { ...params, show, focus: null }, locale)}
          className={styles.chip}
          aria-current={params.show === show ? 'true' : undefined}
        >
          {t(`lists.chips.${show ?? 'all'}`)}
        </Link>
      ))}
    </nav>
  )
}
