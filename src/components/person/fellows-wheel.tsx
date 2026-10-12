'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import type { Fellow } from '@/api/people.api'
import { SEASON_ICONS } from '@/components/season-icon'
import { WheelCarousel } from '@/components/ui/wheel-carousel'
import { Link } from '@/i18n/navigation'
import type { Season } from '@/lib/cycle'

/** How many of a fellow's courses the panel lists before linking to the rest. */
const COURSES_SHOWN = 4

/**
 * The fellows on Componentry's wheel: turn it (scroll, drag or arrow keys)
 * and the panel beside it shows who is at the marker: what they taught
 * here and who they are.
 */
export function FellowsWheel({ fellows }: { fellows: Fellow[] }) {
  const t = useTranslations('Fellows')
  const tf = useTranslations('Study.filters')
  const locale = useLocale()
  const [index, setIndex] = useState(0)
  const fellow = fellows[index]
  if (!fellow) return null

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
      <div className="h-[440px] sm:h-[540px]">
        <WheelCarousel
          announce={(item, i, n) => t('announce', { name: item.label, n: i + 1, total: n })}
          apexInset={14}
          appear={false}
          contentWidth={820}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          gap={24}
          items={fellows.map((f) => ({
            label: f.name,
            ...(f.photo ? { image: f.photo.url, imageAlt: f.photo.alt } : {}),
          }))}
          label={t('wheel')}
          markerSize={8}
          onActiveChange={(_, i) => setIndex(i)}
          photoWidth={32}
          radius={280}
          spacing={13}
        />
      </div>

      <section aria-live="polite" className="min-w-0">
        <p className="text-sm text-[var(--text-muted)]">{t('fellow')}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight rtl:tracking-normal" dir="auto">
          <Link className="underline-offset-4 hover:underline" href={`/people/${fellow.slug}`}>
            {fellow.name}
          </Link>
        </h2>

        <h3 className="mt-6 text-sm font-medium">{t('taught', { count: fellow.courses.length })}</h3>
        <ul className="mt-2 grid gap-2">
          {fellow.courses.slice(0, COURSES_SHOWN).map((c) => {
            const Icon = c.season ? SEASON_ICONS[c.season as Season] : null
            return (
              <li className="grid grid-cols-[1rem_1fr] gap-x-3 text-sm" key={c.slug}>
                {Icon ? (
                  <Icon aria-hidden className="course-season mt-0.5" data-season={c.season} size={16} strokeWidth={1.5} />
                ) : (
                  <span />
                )}
                <span>
                  <Link className="underline-offset-4 hover:underline" dir="auto" href={`/study/${c.slug}`}>
                    {c.title}
                  </Link>
                  {c.season && c.year ? (
                    <span className="block text-xs text-[var(--text-muted)]">
                      {tf(`seasons.${c.season}`)} {c.year}
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>

        {fellow.bio ? (
          <p className="mt-6 line-clamp-6 text-sm leading-relaxed text-[var(--text-secondary)]" dir="auto">
            {fellow.bio}
          </p>
        ) : null}

        <Link
          className="mt-6 inline-flex h-9 items-center rounded-full px-4 text-sm shadow-[0_0_0_1px_var(--border)] hover:bg-[var(--surface-muted)]"
          href={`/people/${fellow.slug}`}
        >
          {fellow.courses.length > COURSES_SHOWN ? t('allCourses', { count: fellow.courses.length }) : t('profile')}
        </Link>
      </section>
    </div>
  )
}
