'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { searchCourses } from '@/app/(frontend)/[locale]/study/actions'

import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { Pagination } from '@/components/arc/pagination/pagination'
import {
  FilterToolbar,
  type FilterChip,
  type FilterField,
} from '@/components/arc/filter-toolbar/filter-toolbar'
import { SearchField } from '@/components/arc/search-field/search-field'
import { HoverExpand } from '@/components/unlumen-ui/hover-expand'
import {
  COURSE_FACETS,
  facetOptions,
  matchesFacets,
  readCourseQuery,
  type CourseFacet,
  type StudyCard,
} from '@/lib/course-search'

/** Courses on a page of the list. */
const PAGE_SIZE = 20

/**
 * The study list: a search over everything a course has and filters over its
 * metadata. Both live in the URL (`?type=thematic&q=…`), so the navbar's
 * links open a filtered list and a filtered list can be shared. The search
 * runs on the server, which holds every course's words.
 */
export function StudyList({
  courses,
  initialSearch,
}: {
  courses: StudyCard[]
  /** The answer to the URL's search, from the page. */
  initialSearch?: { q: string; ids: number[] }
}) {
  const t = useTranslations('Study.filters')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
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
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
  }

  // The last answer; while a newer search is on its way, the list keeps it.
  const [found, setFound] = useState(() =>
    initialSearch ? { q: initialSearch.q, ids: new Set(initialSearch.ids) } : null,
  )
  const wanted = text.trim()

  useEffect(() => {
    if (!wanted || wanted === found?.q) return
    let stale = false
    const timer = setTimeout(async () => {
      const ids = await searchCourses(locale, wanted)
      if (!stale) setFound({ q: wanted, ids: new Set(ids) })
    }, 200)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [wanted, found?.q, locale])

  useEffect(() => {
    if (wanted === (query.q ?? '')) return
    const timer = setTimeout(
      () =>
        navigate((next) => {
          if (wanted) next.set('q', wanted)
          else next.delete('q')
        }),
      400,
    )
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted])

  // Options come from the courses, each with how many it has.
  const options = useMemo(() => facetOptions(courses), [courses])
  const fields: FilterField[] = COURSE_FACETS.filter((f) => options[f].length > 1).map((f) => ({
    id: f,
    label: t(`facets.${f}`),
    options: options[f].map((o) => ({ value: o.value, label: o.label, hint: o.count })),
  }))

  const chips: FilterChip[] = COURSE_FACETS.flatMap((f) => {
    const value = query[f]
    if (!value) return []
    const label = options[f].find((o) => o.value === value)?.label ?? value
    return [{ id: f, label: t(`facets.${f}`), value: label }]
  })

  const shown = courses.filter(
    (c) => matchesFacets(c, query) && (!wanted || !found || found.ids.has(c.id)),
  )

  // A page of the list at a time; the page is in the URL (`?page=2`).
  const listRef = useRef<HTMLDivElement>(null)
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), pageCount)
  const onPage = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const goToPage = (next: number) => {
    navigate((p) => (next > 1 ? p.set('page', String(next)) : p.delete('page')), true)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
          {wanted && found?.q !== wanted ? t('searching') : t('count', { count: shown.length })}
        </p>
      </div>

      {shown.length ? (
        <div className="scroll-mt-28" ref={listRef}>
          <HoverExpand
            start={(page - 1) * PAGE_SIZE + 1}
            items={onPage.map((c) => ({
              label: c.title,
              sublabel: c.sublabel,
              description: c.description,
              image: c.image,
              imageAlt: c.imageAlt,
              href: c.href,
            }))}
          />
          {pageCount > 1 ? (
            // Pages run left to right in either language, like the calendar's arrows.
            <div className="mt-8 flex justify-center" dir="ltr">
              <Pagination
                label={t('pages')}
                nextLabel={t('nextPage')}
                onPageChange={goToPage}
                page={page}
                pageCount={pageCount}
                pageLabel={(n) => t('page', { n })}
                previousLabel={t('previousPage')}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState description={t('emptyText')} title={t('empty')} />
      )}
    </section>
  )
}
