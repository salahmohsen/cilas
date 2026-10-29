import { Clock, Hourglass, Wallet } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { bridgeYearPath, type BridgeYear } from '@/api/programmes.api'
import { getContactEmail } from '@/api/contact.api'
import type { BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'
import { BridgeCourses } from '@/components/bridge/bridge-courses'
import { RegisterBar } from '@/app/(frontend)/[locale]/study/[slug]/RegisterBar'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { ShareBar } from '@/components/share-bar'
import { Link } from '@/i18n/navigation'
import type { Season } from '@/lib/cycle'
import { localDigits, numberingSystemOf } from '@/lib/digits'
import { registrationStatus } from '@/lib/registration'
import { focalPointStyle } from '@/lib/media-image'
import type { Cycle } from '@/payload-types'

/**
 * One Bridge year's page: its words, its courses semester by semester, and
 * what it asks. The current year also says how to join; a past one is a
 * record. `years` lists every published year, latest first, to move between
 * them from the side column.
 */
export async function BridgeYearView({
  year,
  locale,
  current,
  years,
  preview = false,
}: {
  year: BridgeYear
  locale: string
  current: boolean
  years: Array<{ slug: string; title: string }>
  /** In the admin's live preview: refresh on each save. */
  preview?: boolean
}) {
  const { programme, cover, semesters } = year
  // The institute's email, the share bar's mail recipient; a failed read leaves the mail unaddressed.
  const email = await getContactEmail()
  const [t, tc, tf, ts, ta, format] = await Promise.all([
    getTranslations('Bridge'),
    getTranslations('Course'),
    getTranslations('Study.filters'),
    getTranslations('Share'),
    getTranslations('Apply'),
    getFormatter(),
  ])

  const cycleName = (cycle: Cycle) =>
    `${tf(`seasons.${cycle.season}`)} ${localDigits(cycle.start_year, locale)}`
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
  // Where the sticky Apply leads, as the details' own button does (RegisterBar).
  const stickyApply =
    !current || !open ? null : viaForm ? `/${locale}/study/bridge/apply` : applyUrl
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
    ...(programme.weekly_hours
      ? [
          {
            icon: Hourglass,
            label: t('commitment'),
            value: t('hours', { count: programme.weekly_hours }),
          },
        ]
      : []),
    ...(programme.schedule_note
      ? [{ icon: Clock, label: t('schedule'), value: programme.schedule_note }]
      : []),
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
                {programme.pricing?.note ? (
                  <span className="block text-(--text-secondary)">{programme.pricing.note}</span>
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

  // The side column renders twice, beside the text on wide screens and in its
  // flow on narrow ones; `at` keeps each copy's ids its own.
  const details = (
    <section aria-label={t('details')} className="course-side">
      {current ? (
        <span className="course-status" data-open={open || undefined}>
          {open ? tc('open') : tc('closed')}
        </span>
      ) : (
        <p className="text-sm text-(--text-secondary)">{t('pastYear')}</p>
      )}
      {!current ? null : open && viaForm ? (
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

  const requirements = (at: string) =>
    programme.requirements ? (
      <section aria-labelledby={`bridge-requirements-${at}`} className="course-side">
        <h2 className="course-side-heading" id={`bridge-requirements-${at}`}>
          {t('requirements')}
        </h2>
        <RichTextField
          className="grid gap-2 text-sm leading-relaxed [&_p]:m-0"
          data={programme.requirements}
        />
      </section>
    ) : null

  const share = (at: string) => (
    <section aria-labelledby={`bridge-share-${at}`} className="course-side">
      <h2 className="course-side-heading" id={`bridge-share-${at}`}>
        {ts('heading')}
      </h2>
      <ShareBar
        email={email}
        label={t('share')}
        path={`/${locale}${current ? '/study/bridge' : bridgeYearPath(programme.slug ?? '')}`}
        title={programme.title}
      />
    </section>
  )

  // A year by its span, and its city when it was not Cairo: «2019–2020 Alexandria».
  const yearLabel = (slug: string) => {
    const [, span = slug, place] = /^bridge-programme-(\d{4}-\d{4})(?:-(.+))?$/.exec(slug) ?? []
    return {
      span: localDigits(span.replace('-', '–'), locale),
      place: place === 'alexandria' ? t('alexandria') : null,
    }
  }
  const yearsNav = (at: string) =>
    years.length > 1 ? (
      <nav aria-labelledby={`bridge-years-${at}`} className="course-side">
        <h2 className="course-side-heading" id={`bridge-years-${at}`}>
          {t('years')}
        </h2>
        <ul className="bridge-years">
          {years.map((y, i) => {
            const { span, place } = yearLabel(y.slug)
            const label = (
              <>
                <span>{span}</span>
                {place ? <span className="bridge-year-place">{place}</span> : null}
              </>
            )
            return (
              <li key={y.slug}>
                {y.slug === programme.slug ? (
                  <span aria-current="page" className="bridge-year">
                    {label}
                  </span>
                ) : (
                  <Link
                    className="bridge-year"
                    href={i === 0 ? '/study/bridge' : bridgeYearPath(y.slug)}
                  >
                    {label}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    ) : null
  // Beside the current year, who can apply follows the apply button; on a past
  // year, the other years come first.
  const side = (at: string) =>
    current ? (
      <>
        {requirements(at)}
        {yearsNav(at)}
        {share(at)}
      </>
    ) : (
      <>
        {yearsNav(at)}
        {requirements(at)}
        {share(at)}
      </>
    )

  return (
    <div
      className={`course-page mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14 xl:px-0 ${stickyApply ? 'max-lg:pb-28' : ''}`}
    >
      {preview ? <RefreshRouteOnSave /> : null}
      {/* As on a course page: once the details' Apply has scrolled away, a bar along the bottom on narrow screens. */}
      {stickyApply ? (
        <div className="lg:hidden">
          <RegisterBar
            applyLabel={tc('apply')}
            applyUrl={stickyApply}
            price={price}
            status={tc('open')}
            variant="bar"
          />
        </div>
      ) : null}
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
            {/* A media cover comes from the storage host, as on course pages; the default is the site's own. */}
            {cover?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={cover.alt ?? ''}
                className="course-cover"
                height={cover.height ?? undefined}
                src={cover.url}
                style={focalPointStyle(cover)}
                width={cover.width ?? undefined}
              />
            ) : (
              <Image
                alt={t('metaTitle')}
                className="course-cover"
                height={1536}
                priority
                sizes="(min-width: 64rem) 46rem, 100vw"
                src="/assets/images/cilas-classroom.jpg"
                width={2048}
              />
            )}
          </figure>

          {/* Narrow screens: the details come before the text. */}
          <div className="mt-10 grid gap-10 lg:hidden">{details}</div>

          {programme.overview ? (
            <RichTextField className="article-prose mt-10" data={programme.overview} />
          ) : null}

          {posts.length ? (
            <section aria-labelledby="bridge-courses" className="mt-14">
              <h2 className="course-heading mb-6" id="bridge-courses">
                {t('courses')}
              </h2>
              <BridgeCourses
                posts={posts}
                seasons={seasons}
                semesters={semesters.map(({ cycle }) => cycleName(cycle))}
                title={t('courses')}
              />
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

          {/* Narrow screens: the rest of the side column closes the page. */}
          <div className="mt-14 grid gap-10 lg:hidden">{side('narrow')}</div>
        </article>

        <aside className="hidden lg:flex lg:flex-col lg:gap-10">
          {/* Not sticky: the column can be taller than the screen. Only applying
              follows the reader down, at the column's end, as on a course page. */}
          <div className="grid gap-10">
            {details}
            {side('wide')}
          </div>
          {stickyApply ? (
            <div className="sticky top-22">
              <RegisterBar
                applyLabel={tc('apply')}
                applyUrl={stickyApply}
                price={price}
                status={tc('open')}
                variant="side"
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
