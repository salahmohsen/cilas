import { contributionLabel, formatAmount } from '@/lib/pricing'
import { BRIDGE_PATH } from '@/lib/paths'
import { CAIRO, cairoNoon } from '@/lib/cairo-day'
import { BRIDGE_APPLY_PATH, bridgeYearParts, bridgeYearPath } from '@/lib/paths'
import { Clock, Hourglass, Wallet } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { COVER_SIZES, CoverImage } from '@/components/cover-image'
import type { ReactNode } from 'react'

import { getContactEmail } from '@/api/contact.api'
import { type BridgeYear } from '@/api/programmes.api'
import type { BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'
import { BridgeCourses } from '@/components/bridge/bridge-courses'
import { RegisterBar } from '@/components/course/RegisterBar'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { ShareBar } from '@/components/share-bar'
import { SideCard, SideCardApply, SideCardSection } from '@/components/side-card'
import { Link } from '@/i18n/navigation'
import type { Season } from '@/lib/cycle'
import { localDigits, numberingSystemOf } from '@/lib/digits'
import { POSTER_COLORS } from '@/components/arc/lib/poster-colors'
import { registrationStatus } from '@/lib/registration'
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
  const viaForm = programme.registration?.method === 'form' && Boolean(programme.registration.form)
  const applyUrl = open && !viaForm ? (programme.registration?.url ?? null) : null
  const price = contributionLabel(programme.pricing, { locale })
  const stickyApply =
    !current || !open ? null : viaForm ? `/${locale}${BRIDGE_APPLY_PATH}` : applyUrl
  const plan = programme.pricing?.payment_plans?.[0]
  const instalments = plan?.installments ?? []

  const day = (iso: string) =>
    format.dateTime(cairoNoon(iso), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: CAIRO,
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
                      amount: formatAmount(instalments[0]!.amount, locale),
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

  // Once registration has closed, the form's page still shows the questions.
  const applyHref = viaForm ? `/${locale}${BRIDGE_APPLY_PATH}` : applyUrl
  const sideApply = current ? (
    <SideCardApply
      applyLabel={open ? tc('apply') : ta('questions')}
      applyUrl={open || viaForm ? applyHref : null}
      newTab={Boolean(open && applyUrl)}
      open={open}
      price={price}
      primary={open}
      status={open ? tc('open') : tc('closed')}
    />
  ) : null

  const yearLabel = (slug: string) => {
    const { span, place } = bridgeYearParts(slug)
    return {
      span: localDigits(span.replace('-', '–'), locale),
      place: place === 'alexandria' ? t('alexandria') : null,
    }
  }
  const yearsSection =
    years.length > 1 ? (
      <SideCardSection label={t('years')}>
        <ul className="side-card-years">
          {years.map((y, i) => {
            const { span, place } = yearLabel(y.slug)
            const label = (
              <>
                <span>{span}</span>
                {place ? <span className="side-card-role">{place}</span> : null}
              </>
            )
            return (
              <li key={y.slug}>
                {y.slug === programme.slug ? (
                  <span aria-current="page">{label}</span>
                ) : (
                  <Link href={i === 0 ? BRIDGE_PATH : bridgeYearPath(y.slug)}>{label}</Link>
                )}
              </li>
            )
          })}
        </ul>
      </SideCardSection>
    ) : null
  const requirementsSection = programme.requirements ? (
    <SideCardSection label={t('requirements')}>
      <div className="side-card-body">
        <RichTextField
          className="grid gap-2 text-sm leading-relaxed [&_p]:m-0"
          data={programme.requirements}
        />
      </div>
    </SideCardSection>
  ) : null
  const shareSection = (
    <SideCardSection label={ts('heading')}>
      <div className="side-card-body side-card-flush side-card-scroll">
        <ShareBar
          email={email}
          label={t('share')}
          path={`/${locale}${current ? BRIDGE_PATH : bridgeYearPath(programme.slug ?? '')}`}
          title={programme.title}
        />
      </div>
    </SideCardSection>
  )

  const detailsSection =
    facts.length || !current ? (
      <SideCardSection label={t('details')}>
        {!current ? <p className="side-card-body side-card-muted">{t('pastYear')}</p> : null}
        {facts.length ? (
          <dl className="side-card-facts">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <span className="side-card-icon">
                  <Icon aria-hidden size={16} strokeWidth={1.5} />
                </span>
                <div>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        ) : null}
      </SideCardSection>
    ) : null
  const sideCard = (part: 'top' | 'rest' | 'all') => (
    <SideCard color={POSTER_COLORS[0]} label={t('details')}>
      {part !== 'rest' ? detailsSection : null}
      {part !== 'top' ? (
        <>
          {current ? requirementsSection : yearsSection}
          {current ? yearsSection : requirementsSection}
          {shareSection}
        </>
      ) : null}
    </SideCard>
  )

  return (
    <div className={`course-page page-frame py-10 sm:py-14 ${stickyApply ? 'max-lg:pb-28' : ''}`}>
      {preview ? <RefreshRouteOnSave /> : null}
      {/* As on a course page: once the details' Apply has scrolled away, a bar along the bottom on narrow screens. */}
      {stickyApply ? (
        <div className="lg:hidden">
          <RegisterBar
            primaryIds={['bridge-apply-mobile', 'bridge-apply-wide']}
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
          </header>

          <figure className="bridge-figure">
            {/* A media cover comes from the storage host, as on course pages; the default is the site's own. */}
            {cover?.url ? (
              <CoverImage
                preload
                sizes={COVER_SIZES}
                alt={cover.alt ?? ''}
                focal={cover}
                height={cover.height || 600}
                src={cover.url}
                width={cover.width || 800}
              />
            ) : (
              <CoverImage
                preload
                alt={t('metaTitle')}
                height={1536}
                sizes={COVER_SIZES}
                src="/assets/images/cilas-classroom.jpg"
                width={2048}
              />
            )}
          </figure>
          <div className="mt-10 grid gap-6 lg:hidden">
            <div id="bridge-apply-mobile">{sideApply}</div>
            {detailsSection ? sideCard('top') : null}
          </div>

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
          <div className="mt-14 lg:hidden">{sideCard('rest')}</div>
        </article>

        <aside className="hidden lg:flex lg:flex-col lg:gap-10">
          {/* Not sticky: the column can be taller than the screen. Only applying
              follows the reader down, at the column's end, as on a course page. */}
          <div className="grid gap-6">
            <div id="bridge-apply-wide">{sideApply}</div>
            {sideCard('all')}
          </div>
          {stickyApply ? (
            <div className="sticky top-22">
              <RegisterBar
                primaryIds={['bridge-apply-mobile', 'bridge-apply-wide']}
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
