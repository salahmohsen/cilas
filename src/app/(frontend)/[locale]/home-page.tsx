import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { getPublicationCovers, type Locale, type Reader } from '@/api/articles.api'
import { getPublicEvents } from '@/api/events.api'
import { EventGrid } from '@/components/events/event-grid'
import { orderEvents } from '@/lib/events'
import { getContactForm } from '@/api/contact.api'
import { getHomeFaq } from '@/api/faq.api'
import { getHomeArticles, getHomeStats, getOpenNow, getPressOutlets } from '@/api/home.api'
import { FaqSection } from '@/components/arc/blocks/faq-section/faq-section'
import { LogoMarquee } from '@/components/arc/blocks/logo-marquee/logo-marquee'
import { ContactForm } from '@/components/contact/contact-form'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { HomeHero } from '@/components/home/home-hero'
import { HomeScene } from '@/components/home/home-scene'
import { HomeArticles } from '@/components/home/home-articles'
import { OpenNow } from '@/components/home/open-now'
import { Link } from '@/i18n/navigation'
import { toArticleCard } from '@/lib/article-cards'
import { newsletterList } from '@/lib/newsletter-list'

/** Shared by the cached page and the signed-in one. */
export async function homeMetadata(): Promise<Metadata> {
  const [t, tf] = await Promise.all([getTranslations('Home'), getTranslations('Footer')])
  return { title: { absolute: t('metaTitle') }, description: tf('tagline') }
}

/**
 * The home page: the institute in numbers under the opening scene, what is
 * open for registration now, the featured articles, the press and the
 * questions people ask. `reader` is null on the cached page; the signed-in
 * page passes the account, which adds `community` courses to what is open.
 */
export async function HomePage({ locale, reader }: { locale: string; reader: Reader }) {
  const payload = await getPayload({ config })
  const [
    t,
    tHeader,
    tArticle,
    tArticles,
    format,
    open,
    articles,
    stats,
    outlets,
    covers,
    contact,
    faq,
    signup,
    events,
    tEvents,
  ] = await Promise.all([
    getTranslations('Home'),
    getTranslations('Header'),
    getTranslations('Article'),
    getTranslations('Articles'),
    getFormatter(),
    getOpenNow(payload, locale as Locale, reader),
    getHomeArticles(payload, locale as Locale),
    getHomeStats(payload),
    getPressOutlets(payload, locale as Locale),
    getPublicationCovers(payload),
    getContactForm(payload, locale as Locale),
    getHomeFaq(payload, locale as Locale),
    newsletterList(payload),
    getPublicEvents(payload, locale as Locale),
    getTranslations('Events'),
  ])

  const now = new Date()
  const upcoming = orderEvents(events, now).upcoming.slice(0, 3)

  const toCard = (a: (typeof articles.featured)[number]) =>
    toArticleCard(a, {
      locale,
      format,
      minutesLabel: (m) => tArticle('minutes', { count: m }),
      and: tArticle('and'),
      otherCategory: tArticles('notes'),
      publicationCovers: covers,
    })
  const featured = articles.featured.map(toCard)
  const latest = articles.latest.map(toCard)
  const controls = t.raw('controls') as Record<string, string>

  return (
    <>
      <HomeHero
        locale={locale}
        scene={<HomeScene />}
        numbers={{
          title: t('statsTitle'),
          stats: [
            { value: stats.years, label: t('statYears') },
            { value: stats.courses, label: t('statCourses') },
            { value: stats.fellows, label: t('statFellows') },
          ],
        }}
        primary={
          open.length
            ? { label: t('seeOpen'), href: '/#open' }
            : {
                label: t('seeOpen'),
                note: t('noneOpen'),
                // To the footer's signup, which shows only when there is a list.
                ...(signup ? { link: { label: t('noneOpenLink'), href: '#newsletter' } } : {}),
              }
        }
        secondary={{ label: t('readArticles'), href: '/articles' }}
        text={t('heroText')}
        // The institute's name, as the header writes it, line break and all.
        title={tHeader('brand')}
        who={t.raw('heroWho') as string[]}
      />

      <div className="home-page">
        {/* With nothing open there is no section; the hero says so instead. */}
        {open.length ? <OpenNow items={open} locale={locale} /> : null}

        {upcoming.length ? (
          <section aria-labelledby="home-events" className="home-section">
            <header className="home-section-header" data-row>
              <h2 className="home-heading" id="home-events">
                {tEvents('upcoming')}
              </h2>
              <Link className="home-more" href="/events">
                {tEvents('all')}
              </Link>
            </header>
            <EventGrid events={upcoming} now={now} />
          </section>
        ) : null}

        {/* What editors chose, the first set large; then the newest of the rest. */}
        {featured.length ? (
          <section aria-labelledby="home-featured" className="home-section">
            <header className="home-section-header" data-row>
              <h2 className="home-heading" id="home-featured">
                {t('featuredTitle')}
              </h2>
              <Link className="home-more" href="/articles">
                {t('allArticles')}
              </Link>
            </header>
            <ArticlesGrid
              categories={[]}
              description=""
              flush
              header={false}
              pageSize={featured.length}
              posts={featured}
              title={t('featuredTitle')}
            />
          </section>
        ) : null}

        {latest.length ? (
          <section aria-labelledby="home-latest" className="home-section">
            <header className="home-section-header" data-row>
              <h2 className="home-heading" id="home-latest">
                {t('latestTitle')}
              </h2>
              {featured.length ? null : (
                <Link className="home-more" href="/articles">
                  {t('allArticles')}
                </Link>
              )}
            </header>
            <HomeArticles posts={latest} title={t('latestTitle')} />
          </section>
        ) : null}

        {outlets.length ? (
          <div className="home-press">
            <LogoMarquee
              brands={outlets.map((o) => ({
                name: o.name,
                ...(o.logo ? { logo: o.logo } : {}),
                ...(o.href ? { href: o.href } : {}),
              }))}
              description={t('pressText')}
              labels={{
                list: controls.outlets,
                play: controls.play,
                pause: controls.pause,
                playLabel: controls.playMotion,
                pauseLabel: controls.pauseMotion,
                paused: controls.motionPaused,
              }}
              title={t('pressTitle')}
              tone="mono"
            />
          </div>
        ) : null}

        {faq.length ? (
          <FaqSection
            className="home-faq"
            contact={{
              label: t('faqContact'),
              description: t('faqContactText'),
              href: '#contact',
            }}
            description={t('faqText')}
            items={faq}
            layout="split"
            title={t('faqTitle')}
            variant="accordion"
          />
        ) : null}

        {contact ? (
          <div className="home-contact" id="contact">
            <ContactForm {...contact} flush />
          </div>
        ) : null}
      </div>
    </>
  )
}
