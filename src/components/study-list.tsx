'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import type { StudyPage } from '@/api/study-index'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import {
  FilterToolbar,
  type FilterChip,
  type FilterField,
} from '@/components/arc/filter-toolbar/filter-toolbar'
import { Pagination } from '@/components/arc/pagination/pagination'
import { SearchField } from '@/components/arc/search-field/search-field'
import { CourseRows } from '@/components/course-rows'
import { COURSE_FACETS, readCourseQuery, type CourseFacet } from '@/lib/course-search'
import { localDigits } from '@/lib/digits'

/**
 * The study list: a search over everything a course has, filters over its
 * metadata, and a page at a time. All three live in the URL
 * (`?type=thematic&q=…&page=2`); the server works the list out from it and
 * sends one page, so the browser never holds the whole catalogue. Here the
 * controls change the URL, and the list dims while the next page comes.
 */
export function StudyList({ result, pageSize }: { result: StudyPage; pageSize: number }) {
  const t = useTranslations('Study.filters')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const query = useMemo(() => readCourseQuery(new URLSearchParams(params.toString())), [params])

  // The field answers at once; the URL follows when typing pauses.
  const [text, setText] = useState(query.q ?? '')
  const [prevQ, setPrevQ] = useState(query.q)
  if (prevQ !== query.q) {
    setPrevQ(query.q)
    setText(query.q ?? '')
  }

  // Any change to the search or filters starts the list again at its first page.
  const navigate = (change: (next: URLSearchParams) => void, keepPage = false) => {
    const next = new URLSearchParams(params.toString())
    if (!keepPage) next.delete('page')
    change(next)
    const search = next.toString()
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }))
  }

  const wanted = text.trim()
  useEffect(() => {
    if (wanted === (query.q ?? '')) return
    const timer = setTimeout(
      () =>
        navigate((next) => {
          if (wanted) next.set('q', wanted)
          else next.delete('q')
        }),
      350,
    )
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted])

  const { options } = result
  const fields: FilterField[] = COURSE_FACETS.filter((f) => options[f].length > 1).map((f) => ({
    id: f,
    label: t(`facets.${f}`),
    options: options[f].map((o) => ({ value: o.value, label: o.label, hint: localDigits(o.count, locale) })),
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
  const typing = wanted !== (query.q ?? '')

  return (
    <section className="study-list flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <SearchField
          clearLabel={t('clearSearch')}
          label={t('search')}
          onValueChange={setText}
          placeholder={t('searchPlaceholder')}
          value={text}
        />
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
        <p aria-live="polite" className="text-sm text-[var(--text-secondary)]">
          {pending || typing ? t('searching') : t('count', { count: result.total })}
        </p>
      </div>

      <div
        aria-busy={pending || undefined}
        className="scroll-mt-28 transition-opacity duration-150"
        ref={listRef}
        style={{ opacity: pending ? 0.55 : 1 }}
      >
        {result.rows.length ? (
          <>
            <CourseRows rows={result.rows} start={(result.page - 1) * pageSize + 1} />
            {result.pageCount > 1 ? (
              // Pages run left to right in either language, like the calendar's arrows.
              <div className="mt-8 flex justify-center" dir="ltr">
                <Pagination
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
