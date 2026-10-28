'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, MessageSquare } from 'lucide-react'
import { SearchResultContent } from '@/components/search-result-content'
import { ExpandableText } from '@/components/arc/expandable-text/expandable-text'
import { useLocale, useTranslations } from 'next-intl'
import { AUTH_CHANGED, announceAuthChange } from '@/lib/auth-events'
import { ResultsFooter, SearchEmptyState } from '@/components/search-results'
import type { SearchAggregates, SearchPage, SpaceOption } from '@/lib/private-search/model'

export function usePrivateSpaces() {
  const locale = useLocale()
  const [state, setState] = useState<{ spaces: SpaceOption[]; account: number } | null>(null)
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    let controller: AbortController | undefined
    const refresh = () => {
      controller?.abort()
      const pending = new AbortController()
      controller = pending
      setState(null)
      setEpoch((n) => n + 1)
      if (document.visibilityState === 'hidden') return
      fetch('/api/spaces-search', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: true, locale }),
        signal: pending.signal,
      })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((next) => {
          if (!pending.signal.aborted) setState(next)
        })
        .catch(() => {})
    }
    const storage = (event: StorageEvent) => {
      if (event.key === AUTH_CHANGED) refresh()
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener(AUTH_CHANGED, refresh)
    window.addEventListener('storage', storage)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller?.abort()
      window.removeEventListener('focus', refresh)
      window.removeEventListener(AUTH_CHANGED, refresh)
      window.removeEventListener('storage', storage)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [locale])
  return { state, epoch }
}

export type PrivateSearchSummary = {
  shown: number
  searching: boolean
  aggregates: SearchAggregates | null
}

export function PrivateSpaceSearch({
  query,
  spaces,
  sort = 'relevance',
  account,
  onOpen,
  onSummary,
}: {
  query: string
  spaces?: number[]
  sort?: 'relevance' | 'newest' | 'alpha'
  account: number
  onSummary?: (summary: PrivateSearchSummary) => void
  onOpen: (href: string) => void
}) {
  const locale = useLocale()
  const t = useTranslations('Search')
  const [storedPage, setPage] = useState<{ data: SearchPage; binding: string } | null>(null)
  const selection = JSON.stringify(spaces)
  const binding = JSON.stringify([account, query, selection, sort, locale])
  const page = storedPage?.binding === binding ? storedPage.data : null
  const [requestStatus, setRequestStatus] = useState<{
    binding: string
    value: 'idle' | 'loading' | 'error' | 'restart'
  } | null>(null)
  // Discard a previous binding, including when a filter is changed and
  // cleared again before the debounce starts another request.
  if (storedPage && storedPage.binding !== binding) setPage(null)
  if (requestStatus && requestStatus.binding !== binding) setRequestStatus(null)
  const status = requestStatus?.binding === binding ? requestStatus.value : 'loading'
  const controller = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const run = useCallback(
    async (cursor?: string) => {
      controller.current?.abort()
      const pending = new AbortController()
      controller.current = pending
      const request = ++sequence.current
      const report = (value: 'idle' | 'loading' | 'error' | 'restart') =>
        setRequestStatus({ binding, value })
      report('loading')
      if (!cursor) setPage(null)
      try {
        const response = await fetch('/api/spaces-search', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          signal: pending.signal,
          body: JSON.stringify({
            query,
            locale,
            sort,
            ...(selection === undefined ? {} : { spaces: JSON.parse(selection) }),
            ...(cursor ? { cursor } : {}),
          }),
        })
        if (pending.signal.aborted || request !== sequence.current) return
        if (!response.ok) {
          setPage(null)
          report(response.status === 409 ? 'restart' : 'error')
          return
        }
        const next = (await response.json()) as SearchPage
        if (pending.signal.aborted || request !== sequence.current) return
        if (next.account !== account) {
          setPage(null)
          report('restart')
          announceAuthChange()
          return
        }
        setPage((previous) => ({
          binding,
          data:
            cursor && previous?.binding === binding
              ? {
                  ...next,
                  results: Array.from(
                    new Map(
                      [...previous.data.results, ...next.results].map((row) => [row.id, row]),
                    ).values(),
                  ),
                }
              : next,
        }))
        report('idle')
      } catch {
        if (!pending.signal.aborted) {
          setPage(null)
          report('error')
        }
      }
    },
    [account, query, locale, sort, selection, binding],
  )
  useEffect(() => {
    const timer = setTimeout(() => void run(), 250)
    return () => {
      clearTimeout(timer)
      controller.current?.abort()
    }
  }, [query, run])
  const shown = page?.results.length ?? 0
  useEffect(() => {
    onSummary?.({ shown, searching: status === 'loading', aggregates: page?.aggregates ?? null })
  }, [onSummary, shown, status, page?.aggregates])
  return (
    <section aria-label={t('privateSpaces')} aria-busy={status === 'loading'}>
      <p className="sr-only" role="status">
        {status === 'loading' ? t('searching') : ''}
      </p>
      {status === 'restart' || page?.incomplete ? (
        <p className="px-7 pt-4 text-sm text-muted-foreground" role="status">
          {t(status === 'restart' ? 'privateRestart' : 'privateIncomplete')}
        </p>
      ) : null}
      {!page?.results.length && !page?.incomplete && status !== 'restart' ? (
        <SearchEmptyState
          searching={status === 'loading'}
          failed={status === 'error'}
          query={query}
        />
      ) : null}
      <ul className="flex flex-col gap-1 px-4 py-4" aria-label={t('resultsLabel')}>
        {page?.results.map((row) => (
          <li
            key={row.id}
            className="w-full cursor-pointer rounded-2xl px-3.5 py-4 text-start break-words hover:bg-muted/60 focus-within:bg-muted/60 md:px-5 md:py-5"
            onClick={() => onOpen(row.href)}
          >
            <SearchResultContent
              image={row.image}
              icon={
                row.kind === 'post' ? (
                  <FileText width={24} height={24} />
                ) : (
                  <MessageSquare width={24} height={24} />
                )
              }
            >
              <button type="button" data-search-result className="w-full text-start">
                <p className="text-[16px] leading-[1.4] font-medium" dir="auto">
                  {row.title}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground" dir="auto">
                  {row.space} · {t(row.kind === 'post' ? 'privatePost' : 'privateComment')}
                </p>
              </button>
              <ExpandableText
                lines={2}
                moreLabel={t('readMore')}
                lessLabel={t('showLess')}
                className="mt-2.5"
                style={{ fontSize: '15px', lineHeight: 1.45, color: 'inherit' }}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('button')) event.stopPropagation()
                }}
              >
                {row.snippet}
              </ExpandableText>
            </SearchResultContent>
          </li>
        ))}
      </ul>
      {page && (page.results.length > 0 || (page.hasMore && page.cursor)) ? (
        <ResultsFooter
          total={page.aggregates?.total}
          shown={page.results.length}
          hasMore={Boolean(page.hasMore && page.cursor)}
          searching={status === 'loading'}
          onShowMore={() => void run(page.cursor)}
        />
      ) : null}
      {status === 'restart' || status === 'error' ? (
        <button
          type="button"
          className="mx-7 my-5 inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium hover:bg-muted"
          onClick={() => void run()}
        >
          {t('privateRetry')}
        </button>
      ) : null}
    </section>
  )
}
