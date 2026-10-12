import config from '@payload-config'
import { CalendarRange, Clock, Hourglass, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { getBridgeYear, type ProgrammePart } from '@/api/programmes.api'
import { RichTextField } from '@/components/RichTextField'
import { SEASON_ICONS } from '@/components/season-icon'
import { ShareBar } from '@/components/share-bar'
import { Link } from '@/i18n/navigation'
import type { Season } from '@/lib/cycle'
import { localDigits, numberingSystemOf } from '@/lib/digits'
import { ogImages } from '@/lib/og'
import { registrationStatus } from '@/lib/registration'
import type { Cycle } from '@/payload-types'

type Props = { params: Promise<{ locale: string }> }

// Registration open/closed is computed from today's date, so rebuild hourly.
export const revalidate = 3600

const langOf = (locale: string) => (locale === 'ar' ? 'ar' : 'en')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Bridge' })
  const year = await getBridgeYear(await getPayload({ config }), langOf(locale))
  const title = year?.programme.title ?? t('metaTitle')
  const description = year?.programme.tagline ?? t('metaDescription')
  return {
    title,
    description,
    openGraph: { title, description, images: ogImages(year?.cover?.url ?? undefined) },
  }
}

/**
 * The Bridge Programme: the current year's words, its two semesters with the
 * courses each part draws from its cycle, what it asks, and how to join.
 */
export default async function BridgePage({ params }: Props) {
  const { locale } = await params
  const lang = langOf(locale)
  const [t, tc, tf, ts, format] = await Promise.all([
    getTranslations('Bridge'),
    getTranslations('Course'),
    getTranslations('Study.filters'),
    getTranslations('Share'),
    getFormatter(),
  ])
  const year = await getBridgeYear(await getPayload({ config }), lang)
  if (!year) notFound()
  const { programme, cover, semesters, members } = year

  const cycleName = (cycle: Cycle) => `${tf(`seasons.${cycle.season}`)} ${localDigits(cycle.start_year, locale)}`
  const open = registrationStatus(programme.registration) === 'open'
  const applyUrl = open ? (programme.registration?.url ?? null) : null
  // Fees in the page's own currency format: EGP 18,000, or ١٨٬٠٠٠ ج.م.
  const pricing = programme.pricing
  const money = (amount: number) =>
    format.number(amount, {
      style: 'currency',
      currency: pricing?.currency ?? 'EGP',
      maximumFractionDigits: 0,
      numberingSystem: numberingSystemOf(locale),
    })
  const price =
    typeof pricing?.min === 'number'
      ? typeof pricing.max === 'number' && pricing.max > pricing.min
        ? `${money(pricing.min)}–${money(pricing.max)}`
        : money(pricing.min)
      : null
  const plan = programme.pricing?.payment_plans?.[0]
  const instalments = plan?.installments ?? []
  const first = semesters[0]?.cycle
  const last = semesters.at(-1)?.cycle
  const testimonial = programme.testimonials?.[0]

  const facts: Array<{ icon: typeof Clock; label: string; value: ReactNode }> = [
    ...(first && last && first.id !== last.id
      ? [{ icon: CalendarRange, label: t('period'), value: t('cycles', { from: cycleName(first), to: cycleName(last) }) }]
      : []),
    ...(programme.weekly_hours ? [{ icon: Hourglass, label: t('commitment'), value: t('hours', { count: programme.weekly_hours }) }] : []),
    ...(programme.schedule_note ? [{ icon: Clock, label: t('schedule'), value: programme.schedule_note }] : []),
    ...(price
      ? [
          {
            icon: Wallet,
            label: t('fees'),
            value: (
              <>
                <span className="block">{price}</span>
                {plan && instalments.length > 1 ? (
                  <span className="block text-(--text-secondary)">
                    {t('plan', {
                      label: plan.label,
                      count: instalments.length,
                      amount: money(instalments[0]!.amount),
                    })}
                  </span>
                ) : null}
                {programme.pricing?.need_based_deductions ? (
                  <span className="block text-(--text-secondary)">{t('needBased')}</span>
                ) : null}
              </>
            ),
          },
        ]
      : []),
  ]

  const details = (
    <section aria-label={t('details')} className="course-side">
      <span className="course-status" data-open={open || undefined}>
        {open ? tc('open') : tc('closed')}
      </span>
      {applyUrl ? (
        <a className="course-apply" data-primary href={applyUrl} rel="noopener" target="_blank">
          {tc('apply')}
        </a>
      ) : null}
      <dl className="course-facts">
        {facts.map(({ icon: Icon, label, value }) => (
          <div className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3" key={label}>
            <Icon aria-hidden className="mt-0.5 text-(--text-muted)" size={16} strokeWidth={1.5} />
            <div>
              <dt className="text-xs text-(--text-muted)">{label}</dt>
              <dd className="text-sm">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )

  const requirements = programme.requirements ? (
    <section aria-labelledby="bridge-requirements" className="course-side">
      <h2 className="course-side-heading" id="bridge-requirements">
        {t('requirements')}
      </h2>
      <RichTextField className="grid gap-2 text-sm leading-relaxed [&_p]:m-0" data={programme.requirements} />
    </section>
  ) : null

  const share = (
    <section aria-labelledby="bridge-share" className="course-side">
      <h2 className="course-side-heading" id="bridge-share">
        {ts('heading')}
      </h2>
      <ShareBar label={t('share')} path={`/${locale}/study/bridge`} title={programme.title} />
    </section>
  )

  return (
    <div className="course-page mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14 xl:px-0">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <article aria-labelledby="bridge-title" className="min-w-0">
          <header>
            <h1 className="course-title" id="bridge-title">
              {programme.title}
            </h1>
            {programme.tagline ? <p className="bridge-tagline">{programme.tagline}</p> : null}
            {programme.highlights?.length ? (
              <ul className="bridge-highlights">
                {programme.highlights.map((h, i) => (
                  <li key={h.id ?? i}>{h.text}</li>
                ))}
              </ul>
            ) : null}
          </header>

          <figure className="bridge-figure">
            <Image
              alt={cover?.alt ?? t('metaTitle')}
              className="course-cover"
              height={cover?.height ?? 1536}
              priority
              sizes="(min-width: 64rem) 46rem, 100vw"
              src={cover?.url ?? '/assets/images/cilas-classroom.jpg'}
              width={cover?.width ?? 2048}
            />
          </figure>

          {/* Narrow screens: the details come before the text. */}
          <div className="mt-10 grid gap-10 lg:hidden">{details}</div>

          {programme.overview ? (
            <RichTextField className="article-prose mt-10" data={programme.overview} />
          ) : null}

          {semesters.length ? (
            <section aria-labelledby="bridge-year" className="mt-14">
              <h2 className="course-heading" id="bridge-year">
                {t('year')}
              </h2>
              <ol className="bridge-semesters">
                {semesters.map(({ cycle, parts }, i) => {
                  const SeasonIcon = SEASON_ICONS[cycle.season as Season]
                  return (
                    <li className="bridge-semester" key={cycle.id}>
                      <h3 className="bridge-semester-title">
                        {SeasonIcon ? (
                          <SeasonIcon aria-hidden className="course-season" data-season={cycle.season} size={18} strokeWidth={1.5} />
                        ) : null}
                        {cycleName(cycle)}
                      </h3>
                      {parts.map((part) => (
                        <Part
                          comma={lang === 'ar' ? '، ' : ', '}
                          key={part.label}
                          noCourses={t('noCourses')}
                          part={part}
                          typeLabel={(type) => tf(`types.${type.toLowerCase()}`)}
                        />
                      ))}
                      {programme.self_directed_study && i < semesters.length - 1 ? (
                        <div className="bridge-interlude">
                          <p className="font-medium">{t('selfDirected')}</p>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : null}

          {testimonial ? (
            <div className="article-prose mt-14">
              <blockquote className="quote-with-source">
                <p>{testimonial.quote}</p>
                {testimonial.attribution ? (
                  <footer>
                    <cite>{testimonial.attribution}</cite>
                  </footer>
                ) : null}
              </blockquote>
            </div>
          ) : null}

          <section aria-labelledby="bridge-cohort" className="mt-14">
            <h2 className="course-heading" id="bridge-cohort">
              {t('cohort')}
            </h2>
            <p className="mt-3 text-(--text-secondary)">{t('cohortText', { count: members })}</p>
            <Link className="bridge-link mt-4" href="/people/cilasians">
              {t('meetCohort')}
            </Link>
          </section>

          {/* Narrow screens: who can apply and sharing close the page. */}
          <div className="mt-14 grid gap-10 lg:hidden">
            {requirements}
            {share}
          </div>
        </article>

        <aside className="hidden lg:flex lg:flex-col lg:gap-10">
          {details}
          {requirements}
          {share}
        </aside>
      </div>
    </div>
  )
}

/** One part of a semester: its label, and the courses it draws, each linked. */
function Part({
  part,
  noCourses,
  typeLabel,
  comma,
}: {
  part: ProgrammePart
  comma: string
  noCourses: string
  typeLabel: (type: string) => string
}) {
  return (
    <div className="bridge-part">
      <p className="bridge-part-label">{part.label}</p>
      {part.description ? <p className="text-sm text-(--text-secondary)">{part.description}</p> : null}
      {part.courses.length ? (
        <ul className="bridge-courses">
          {part.courses.map((c) => (
            <li key={c.id}>
              <Link className="bridge-course" dir={/[\u0600-\u06ff]/.test(c.title) ? 'rtl' : 'ltr'} href={`/study/${c.slug}`}>
                <span className="bridge-course-title">
                  {c.title}
                </span>
                <span className="bridge-course-meta">
                  {[typeLabel(c.type), c.fellows.join(comma)].filter(Boolean).join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bridge-empty">{noCourses}</p>
      )}
    </div>
  )
}
