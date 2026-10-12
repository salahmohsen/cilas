import config from '@payload-config'
import { Clock, Hourglass, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { getBridgeYear } from '@/api/programmes.api'
import type { BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'
import { BridgeCourses } from '@/components/bridge/bridge-courses'
import { RichTextField } from '@/components/RichTextField'
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
  const [t, tc, tf, ts, ta, format] = await Promise.all([
    getTranslations('Bridge'),
    getTranslations('Course'),
    getTranslations('Study.filters'),
    getTranslations('Share'),
    getTranslations('Apply'),
    getFormatter(),
  ])
  const year = await getBridgeYear(await getPayload({ config }), lang)
  if (!year) notFound()
  const { programme, cover, semesters, members } = year

  const cycleName = (cycle: Cycle) => `${tf(`seasons.${cycle.season}`)} ${localDigits(cycle.start_year, locale)}`
  const open = registrationStatus(programme.registration) === 'open'
  // Applying through the site's own form leads to its page; otherwise to wherever registration points.
  const viaForm = programme.registration?.method === 'form' && Boolean(programme.registration.form)
  const applyUrl = open && !viaForm ? (programme.registration?.url ?? null) : null
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
  const testimonial = programme.testimonials?.[0]

  // The year's courses as cards, semester by semester; a course drawn by two parts shows once.
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Cairo',
      numberingSystem: numberingSystemOf(locale),
    })
  const seasons: Record<string, Season> = {}
  const posts: BlogPost[] = semesters.flatMap(({ cycle, parts }) =>
    parts
      .flatMap((part) => part.courses)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title))
      .flatMap((c) => {
        if (c.slug in seasons) return []
        seasons[c.slug] = cycle.season as Season
        const [lead, ...others] = c.fellows
        return [
          {
            id: c.slug,
            title: c.title,
            excerpt: c.excerpt,
            category: cycleName(cycle),
            label: tf(`types.${c.type.toLowerCase()}`),
            date: c.startDate,
            dateLabel: day(c.startDate),
            readTime: 0,
            readTimeLabel: others.length ? t('moreFellows', { count: others.length }) : '',
            author: { name: lead?.name ?? '', avatar: lead?.avatar ?? undefined },
            image: c.image ?? undefined,
          },
        ]
      }),
  )

  const facts: Array<{ icon: typeof Clock; label: string; value: ReactNode }> = [
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
                {programme.pricing?.note ? <span className="block text-(--text-secondary)">{programme.pricing.note}</span> : null}
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
      {open && viaForm ? (
        <Link className="course-apply" data-primary href="/study/bridge/apply">
          {tc('apply')}
        </Link>
      ) : applyUrl ? (
        <a className="course-apply" data-primary href={applyUrl} rel="noopener" target="_blank">
          {tc('apply')}
        </a>
      ) : viaForm ? (
        <Link className="bridge-link" href="/study/bridge/apply">
          {ta('questions')}
        </Link>
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

          {posts.length ? (
            <section aria-labelledby="bridge-year" className="mt-14">
              <h2 className="course-heading mb-6" id="bridge-year">
                {t('year')}
              </h2>
              <BridgeCourses posts={posts} seasons={seasons} semesters={semesters.map(({ cycle }) => cycleName(cycle))} title={t('year')} />
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
