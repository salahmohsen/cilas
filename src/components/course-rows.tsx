'use client'

import {
  ArrowUpRight,
  BookOpenText,
  FlaskConical,
  GraduationCap,
  Hammer,
  Hourglass,
  MapPin,
  type LucideIcon,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

import type { StudyRow } from '@/api/study-index'
import { SEASON_ICONS } from '@/components/season-icon'
import type { Season } from '@/lib/cycle'
import { localDigits } from '@/lib/digits'

/** A course type's mark, beside its name. */
export const TYPE_ICONS: Record<string, LucideIcon> = {
  core: GraduationCap,
  thematic: BookOpenText,
  lab: FlaskConical,
  workshop: Hammer,
  short: Hourglass,
}

/** A course's type, cycle and place, each with its mark. */
export function CourseMeta({ row }: { row: StudyRow }) {
  const TypeIcon = TYPE_ICONS[row.type.value]
  const SeasonIcon = row.season ? SEASON_ICONS[row.season.value as Season] : null
  return (
    <ul className="course-meta">
      <li>
        {TypeIcon ? <TypeIcon aria-hidden size={14} strokeWidth={1.75} /> : null}
        {row.type.label}
      </li>
      {row.season && row.year ? (
        <li>
          {SeasonIcon ? (
            <SeasonIcon aria-hidden className="course-season" data-season={row.season.value} size={14} strokeWidth={1.75} />
          ) : null}
          {row.season.label} {row.year}
        </li>
      ) : null}
      {row.place ? (
        <li>
          <MapPin aria-hidden size={14} strokeWidth={1.75} />
          {row.place}
        </li>
      ) : null}
    </ul>
  )
}

/**
 * The courses of one page of the study list, a row each: its number, title
 * and meta. Pointing at a row (or tabbing to it) opens it to its cover and
 * the start of its description while the others step back; the whole row
 * is the link to the course.
 */
export function CourseRows({ rows, start }: { rows: StudyRow[]; start: number }) {
  const t = useTranslations('Study.filters')
  const locale = useLocale()
  return (
    <ol className="course-rows">
      {rows.map((row, i) => (
        <li className="course-row" data-cover={row.image ? '' : undefined} key={row.id}>
          {row.image ? (
            <span aria-hidden className="course-row-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" decoding="async" loading="lazy" src={row.image} />
            </span>
          ) : null}
          <span className="course-row-number">{localDigits(String(start + i).padStart(2, '0'), locale)}</span>
          <div className="course-row-main">
            <h3 className="course-row-title">
              {/* The href already carries its locale (`/en/study/…`), so a plain
                  link. The title's link stretches over the whole row. Its direction is
                  its own, so it keeps its punctuation while aligning with the page. */}
              <Link className="course-row-link" dir="auto" href={row.href}>
                {row.title}
              </Link>
            </h3>
            {row.description ? (
              <p className="course-row-description" dir="auto">
                {row.description}
              </p>
            ) : null}
            <span className="course-row-cta">
              {t('viewCourse')}
              <ArrowUpRight aria-hidden className="rtl:-scale-x-100" size={14} />
            </span>
          </div>
          <CourseMeta row={row} />
        </li>
      ))}
    </ol>
  )
}
