'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'

import type { StudyPage } from '@/api/study-index'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import {
  FilterToolbar,
  type FilterChip,
  type FilterField,
} from '@/components/arc/filter-toolbar/filter-toolbar'
import { Pagination } from '@/components/arc/pagination/pagination'
import { Skeleton } from '@/components/arc/skeleton/skeleton'
import { CourseRows } from '@/components/course-rows'
import { COURSE_FACETS, readCourseQuery, type CourseFacet } from '@/lib/course-search'
import { localDigits } from '@/lib/digits'

/**
 * True once `active` has lasted `delay` ms, and then for at least `min` ms, so
 * a quick change never flashes a placeholder and a slow one never blinks it.
 */
function useSlow(active: boolean, delay = 400, min = 350) {
  const [slow, setSlow] = useState(false)
  const since = useRef(0)
  useEffect(() => {
    if (active) {
      const id = setTimeout(() => {
        since.current = performance.now()
        setSlow(true)
      }, delay)
      return () => clearTimeout(id)
    }
    const id = setTimeout(
      () => setSlow(false),
      Math.max(0, min - (performance.now() - since.current)),
    )
    return () => clearTimeout(id)
  }, [active, delay, min])
  return slow
}

/**
 * The study list: filters over a course's metadata, and a page at a time. All
 * live in the URL (`?type=thematic&page=2`); the server works the list out
 * from it and sends one page, so the browser never holds the whole catalogue.
 * Here the controls change the URL, and the list dims while the next page
 * comes. The page's header card holds the filters, so the title can show a
 * dot while any filter is on.
 */
export function StudyList({
  intro,
  pageSize,
  quote,
  result,
  title,
}: {
  intro: ReactNode
  pageSize: number
  quote: ReactNode
  result: StudyPage
  title: string
}) {
  const t = useTranslations('Study.filters')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const query = useMemo(() => readCourseQuery(new URLSearchParams(params.toString())), [params])

  const navigate = (change: (next: URLSearchParams) => void, keepPage = false) => {
    const next = new URLSearchParams(params.toString())
    if (!keepPage) next.delete('page')
    change(next)
    const search = next.toString()
    startTransition(() =>
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }),
    )
  }

  const { options } = result
  const fields: FilterField[] = COURSE_FACETS.filter((f) => options[f].length > 1).map((f) => ({
    id: f,
    label: t(`facets.${f}`),
    options: options[f].map((o) => ({
      value: o.value,
      label: o.label,
      hint: localDigits(o.count, locale),
    })),
  }))

  const chips: FilterChip[] = COURSE_FACETS.flatMap((f) => {
    const value = query[f]
    if (!value) return []
    const label = options[f].find((o) => o.value === value)?.label ?? value
    return [{ id: f, label: t(`facets.${f}`), value: label }]
  })

  const listRef = useRef<HTMLDivElement>(null)
  const goToPage = (next: number) => {
    navigate((p) => (next > 1 ? p.set('page', String(next)) : p.delete('page')), true)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params.toString())
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    return `${pathname}${next.size ? `?${next}` : ''}`
  }
  const slow = useSlow(pending)

  return (
    <section className="study-list flex flex-col gap-12">
      <header className="study-card-frame">
        <div className="study-card">
          <div className="study-card-panel">
            <h1 className="study-title">
              {title}
              {chips.length ? (
                <span
                  aria-hidden
                  className="study-filter-dot"
                  data-pending={pending || undefined}
                />
              ) : null}
            </h1>
            {intro}
          </div>
          {quote}
          <div className="study-card-filters">
            <FilterToolbar
              addFilter={{
                fields,
                label: t('add'),
                onAdd: (chip, field) => {
                  const value = field.options
                    .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
                    .find((o) => (o.label ?? o.value) === chip.value)?.value
                  if (value) navigate((next) => next.set(field.id as CourseFacet, value))
                },
              }}
              filters={chips}
              label={t('label')}
              text={{
                empty: t('none'),
                clearAll: t('clearAll'),
                back: t('back'),
                remove: (chip) => t('remove', { chip }),
                added: (chip) => t('added', { chip }),
                removed: (chip) => t('removed', { chip }),
                changed: (field, value) => t('changed', { field, value }),
                cleared: t('cleared'),
              }}
              onClearAll={() => navigate((next) => COURSE_FACETS.forEach((f) => next.delete(f)))}
              onRemove={(id) => navigate((next) => next.delete(id))}
            />
            <p aria-live="polite" className="study-card-count">
              {pending ? t('searching') : t('count', { count: result.total })}
            </p>
          </div>
        </div>
      </header>

      <div
        aria-busy={pending || undefined}
        className="scroll-mt-28 transition-opacity duration-150"
        ref={listRef}
        style={{ opacity: pending && !slow ? 0.55 : 1 }}
      >
        {slow ? (
          // The "Searching…" line above speaks for the wait; these are only seen.
          <ol aria-hidden className="course-rows">
            {Array.from({ length: Math.max(result.rows.length, 6) }, (_, i) => (
              <li className="course-row course-row-skeleton" key={i}>
                <span className="course-row-number" />
                <Skeleton lines={2} />
              </li>
            ))}
          </ol>
        ) : result.rows.length ? (
          <>
            <CourseRows rows={result.rows} start={(result.page - 1) * pageSize + 1} />
            {result.pageCount > 1 ? (
              // Pages run left to right in either language, like the calendar's arrows.
              <div className="mt-8 flex justify-center" dir="ltr">
                <Pagination
                  getPageHref={pageHref}
                  formatNumber={(n) => localDigits(n, locale)}
                  label={t('pages')}
                  nextLabel={t('nextPage')}
                  onPageChange={goToPage}
                  page={result.page}
                  pageCount={result.pageCount}
                  pageLabel={(n) => t('page', { n })}
                  previousLabel={t('previousPage')}
                />
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState description={t('emptyText')} title={t('empty')} />
        )}
      </div>
    </section>
  )
}
