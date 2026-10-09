import React from 'react'

import { RichTextField } from '@/components/RichTextField'
import type { Course } from '@/payload-types'

/**
 * Presentational view of a single course.
 *
 * Knows nothing about the admin, live preview or draft mode — it renders the
 * course it is given. That keeps the markup reusable by the public page, the
 * live-preview iframe, and anything else that needs to show a course, and it
 * means the preview wiring in `CourseLivePreview` stays a few lines rather than
 * growing around the whole page.
 */
export const CourseView: React.FC<{ course: Course }> = ({ course }) => {
  const cover = course.cover_image && typeof course.cover_image === 'object' ? course.cover_image : null
  const cycle = course.cycle && typeof course.cycle === 'object' ? course.cycle : null

  return (
    <article className="mx-auto w-full max-w-4xl py-16">
      <header>
        <p className="text-xs tracking-widest uppercase opacity-50">{course.course_type}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{course.title}</h1>
        {course.subtitle && <p className="mt-2 text-lg opacity-70">{course.subtitle}</p>}
        {course.epigraph && (
          <blockquote className="mt-6 border-s-2 ps-4 italic opacity-70">{course.epigraph}</blockquote>
        )}
      </header>

      {cover?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={cover.alt} className="mt-8 w-full" src={cover.url} />
      )}

      {course.description ? (
        <div className="mt-8">
          <RichTextField data={course.description} />
        </div>
      ) : null}

      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {course.mode_note && (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">Mode</dt>
            <dd>{course.mode_note}</dd>
          </>
        )}
        {course.location?.length ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">Location</dt>
            <dd>{course.location.join(', ')}</dd>
          </>
        ) : null}
        {cycle?.label ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">Cycle</dt>
            <dd>{cycle.label}</dd>
          </>
        ) : null}
        {course.sessions?.length ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">Sessions</dt>
            <dd>
              {course.sessions.length}
              {(() => {
                // The earliest scheduled session, since there is no separate
                // course-level start date any more.
                const first = course.sessions
                  .map((s) => s.date)
                  .filter(Boolean)
                  .sort()[0]
                return first ? ` — from ${new Date(first).toLocaleDateString()}` : ''
              })()}
            </dd>
          </>
        ) : null}
        {course.tuition?.amount ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">Tuition</dt>
            <dd>
              {course.tuition.amount}
              {course.tuition.based_deductions_available
                ? ' — need-based deductions available'
                : ''}
            </dd>
          </>
        ) : null}
      </dl>

      {course.fields_of_study?.length ? (
        <Section title="Fields of study">
          <ul className="flex flex-wrap gap-2">
            {course.fields_of_study.map((fos) =>
              typeof fos === 'object' ? (
                <li className="rounded-full border px-3 py-1 text-sm" key={fos.id}>
                  {fos.title}
                </li>
              ) : null,
            )}
          </ul>
        </Section>
      ) : null}

      {course.learning_outcomes?.length ? (
        <Section title="Learning outcomes">
          <ul className="list-disc ps-5">
            {course.learning_outcomes.map((item, i) =>
              item?.outcome ? (
                <li key={item.id ?? i}>
                  <RichTextField className="prose-sm" data={item.outcome} />
                </li>
              ) : null,
            )}
          </ul>
        </Section>
      ) : null}

      {course.why_apply?.length ? (
        <Section title="Why apply">
          <ul className="list-disc ps-5">
            {course.why_apply.map((item, i) =>
              item?.point ? <li key={item.id ?? i}>{item.point}</li> : null,
            )}
          </ul>
        </Section>
      ) : null}

      {course.bibliography?.length ? (
        <Section title="Bibliography">
          <ul className="list-disc ps-5">
            {course.bibliography.map((item, i) =>
              item?.citation ? <li key={item.id ?? i}>{item.citation}</li> : null,
            )}
          </ul>
        </Section>
      ) : null}

      {course.weekly_workload ? (
        <Section title="Weekly workload">
          <RichTextField className="prose-sm" data={course.weekly_workload} />
        </Section>
      ) : null}

      {course.sessions?.length ? (
        <Section title="Syllabus">
          <ol className="space-y-4">
            {course.sessions.map((session, i) => (
              <li key={session.id ?? i}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-medium">
                    {session.week ? `Week ${session.week}` : `Session ${i + 1}`}
                    {session.theme ? ` — ${session.theme}` : ''}
                  </p>
                  {session.date ? (
                    <p className="text-sm opacity-60">
                      <time dateTime={session.date}>
                        {new Date(session.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </time>
                      {formatTime(session.time?.start_time, session.time?.end_time) && (
                        <>
                          {' · '}
                          {formatTime(session.time?.start_time, session.time?.end_time)}
                        </>
                      )}
                    </p>
                  ) : null}
                </div>
                {session.description ? (
                  <div className="opacity-70">
                    <RichTextField className="prose-sm" data={session.description} />
                  </div>
                ) : null}
                {session.activity && <p className="text-sm opacity-50">{session.activity}</p>}
                {session.materials?.length ? (
                  <ul className="mt-1 text-sm opacity-70">
                    {session.materials.map((material, j) => (
                      <li key={material.id ?? j}>
                        {material.type}: {material.title}
                        {material.note ? ` — ${material.note}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </article>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-10">
    <h2 className="text-xs tracking-widest uppercase opacity-50">{title}</h2>
    <div className="mt-3 space-y-3">{children}</div>
  </section>
)

/** `"18:00"`, `"2026-04-26T18:00:00.000Z"` or a Date, all mean 6pm. */
const toTimeLabel = (value: string | null | undefined): string | null => {
  if (!value) return null
  const match = /T(\d{2}:\d{2})/.exec(value) ?? /^(\d{2}:\d{2})/.exec(value)
  return match ? match[1] : null
}

const formatTime = (start?: string | null, end?: string | null): string | null => {
  const from = toTimeLabel(start)
  const to = toTimeLabel(end)
  if (from && to) return `${from}–${to}`
  return from ?? to
}
