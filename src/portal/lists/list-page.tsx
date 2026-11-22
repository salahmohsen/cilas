import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import type { Locale } from '@/i18n/routing'
import { currentReader } from '@/lib/reader'
import type { User } from '@/payload-types'
import { PortalEmptyState } from '@/portal/feedback/empty-state'

import { createActionOf, headerCreateOf } from './create-action'
import { emptyStateOf, titleKeyOf } from './empty-states'
import {
  chipGroup,
  MAX_PAGES,
  PAGE_SIZE,
  pagedOf,
  type ListCollection,
  type ListKind,
} from './groups'
import { ListChips } from './list-chips'
import {
  controlsShown,
  DEFAULT_PARAMS,
  hrefOf,
  moreKindOf,
  nextPages,
  parseListParams,
  type ListParams,
} from './list-params'
import { ListSearch } from './list-search'
import { failureOf, ListViewBody, resultOrFailed, secondaryButton } from './list-view'
import styles from './lists.module.css'
import { PortalPageHeader } from './page-header'
import { listKindOf, loadList, type ListGroup, type ListResult } from './rows'
import { NewRowsFocus } from './show-more'

type SearchParams = Record<string, string | string[] | undefined>

const pathOf = (collection: ListCollection) => `/spaces/${collection}`

/** The document title of a list: its H1, then the site. Nothing when the reader may not open it. */
export const listMetadata = async (collection: ListCollection): Promise<Metadata> => {
  const user = await currentReader()
  const kind = user && listKindOf(user, collection)
  if (!kind) return {}
  const t = await getTranslations('Portal')
  return {
    title: t('lists.metaTitle', { name: t(titleKeyOf(collection, kind)) }),
    robots: { index: false },
  }
}

/** The body of a list with its slots filled: the empty state, Show more or the cap line, and the focus after Show more. */
async function ListView({
  result,
  params,
  collection,
  kind,
  user,
  locale,
}: {
  result: ListResult | 'failed'
  params: ListParams
  collection: ListCollection
  kind: ListKind
  user: User
  locale: Locale
}): Promise<React.JSX.Element> {
  const [t, tStudy, format] = await Promise.all([
    getTranslations('Portal'),
    getTranslations('Study.filters'),
    getFormatter(),
  ])
  const path = pathOf(collection)
  const href = (next: Partial<ListParams>) =>
    hrefOf(path, { ...params, focus: null, ...next }, locale)
  const empty = emptyStateOf(collection, kind, createActionOf(collection, user)?.href ?? null)
  const moreOf = (group: ListGroup) => {
    if (!pagedOf(group.id)) return null
    const paged = group.id
    const pages = params.pages[paged] ?? 1
    const next = nextPages(params, paged)
    const firstNewIndex = (pages - 1) * PAGE_SIZE
    const more = moreKindOf(params, paged)
    return (
      <>
        {group.hasMore &&
          (more === 'link' && next !== null ? (
            <Link
              href={href({ pages: { ...params.pages, [paged]: next }, focus: paged })}
              scroll={false}
              className={`${secondaryButton} ${styles.more}`}
              aria-label={t('lists.showMoreIn', { group: t(`lists.group.${group.id}`) })}
            >
              {t('lists.showMore')}
            </Link>
          ) : (
            <p className={styles.cap}>
              {t(more === 'pageCapSearch' ? 'lists.pageCapSearch' : 'lists.pageCap', {
                count: PAGE_SIZE * MAX_PAGES,
              })}
            </p>
          ))}
        {pages > 1 && (
          <NewRowsFocus
            group={paged}
            firstNewIndex={firstNewIndex}
            message={t('lists.moreRows', { count: Math.max(0, group.rows.length - firstNewIndex) })}
            focus={params.focus}
          />
        )}
      </>
    )
  }
  return (
    <ListViewBody
      result={result}
      viewer={kind === 'admin' ? 'admin' : 'owner'}
      query={{ q: params.q, show: params.show }}
      hrefs={{
        retry: href({}),
        clearSearch: href({ q: null }),
        showAll: href({ show: null }),
      }}
      empty={
        <PortalEmptyState
          title={t(empty.titleKey)}
          body={t(empty.bodyKey)}
          next={empty.nextKey && t(empty.nextKey)}
          action={
            empty.action && {
              label: t(empty.action.labelKey),
              href: empty.action.href,
              external: true,
            }
          }
        />
      }
      moreOf={moreOf}
      t={t}
      tStudy={tStudy}
      format={format}
      locale={locale}
      now={new Date()}
    />
  )
}

/**
 * A portal list page: the header, the chips and the search when they
 * show, then the list. The page reads the reader itself, and a reader
 * with no list of this collection (a student on Courses) gets not found,
 * with no streaming boundary above the check.
 */
export async function ListPage({
  collection,
  locale,
  searchParams,
}: {
  collection: ListCollection
  locale: Locale
  searchParams: SearchParams
}): Promise<React.JSX.Element> {
  const path = pathOf(collection)
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}${path}`)}`)
  const kind = listKindOf(user, collection)
  if (!kind) notFound()
  const params = parseListParams(searchParams)
  const [t, payload] = await Promise.all([getTranslations('Portal'), getPayload({ config })])
  const result = await resultOrFailed(
    () =>
      loadList(
        payload,
        user,
        {
          collection,
          search: params.q,
          only: params.show && chipGroup[kind][params.show],
          pages: params.pages,
        },
        locale,
      ),
    (error) => console.error('[portal-lists]', failureOf(error)),
  )
  const create = createActionOf(collection, user)
  const headerCreate = headerCreateOf(
    create,
    emptyStateOf(collection, kind, create?.href ?? null),
    result === 'failed' ? null : result.total,
  )
  return (
    <>
      <PortalPageHeader
        title={t(titleKeyOf(collection, kind))}
        primary={
          headerCreate ? { label: t(headerCreate.labelKey), href: headerCreate.href } : undefined
        }
      />
      {result !== 'failed' && controlsShown(result.total, params) && (
        <div className={styles.controls}>
          <ListChips params={params} path={path} locale={locale} />
          <ListSearch
            key={params.q ?? ''}
            q={params.q}
            show={params.show}
            action={hrefOf(path, DEFAULT_PARAMS, locale)}
            label={t('lists.search')}
            clearLabel={t('lists.clearSearch')}
          />
        </div>
      )}
      <ListView
        result={result}
        params={params}
        collection={collection}
        kind={kind}
        user={user}
        locale={locale}
      />
    </>
  )
}
