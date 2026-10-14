import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { getPublicationCovers, type Locale } from '@/api/articles.api'
import { getContactForm } from '@/api/contact.api'
import { getHomeFaq } from '@/api/faq.api'
import { getHomeArticles, getHomeStats, getOpenNow, getPressOutlets } from '@/api/home.api'
import { FaqSection } from '@/components/arc/blocks/faq-section/faq-section'
import { LogoMarquee } from '@/components/arc/blocks/logo-marquee/logo-marquee'
import { StatsBand } from '@/components/arc/blocks/stats-band/stats-band'
import { ContactForm } from '@/components/contact/contact-form'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { HomeHero } from '@/components/home/home-hero'
import { HomeArticles } from '@/components/home/home-articles'
import { OpenNow } from '@/components/home/open-now'
import { Link } from '@/i18n/navigation'
import { toArticleCard } from '@/lib/article-cards'

// What is open changes with deadlines: worked out again every five minutes.
export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const [t, tf] = await Promise.all([getTranslations('Home'), getTranslations('Footer')])
  return { title: { absolute: t('metaTitle') }, description: tf('tagline') }
}

/**
 * The home page: what is open for registration now, the featured articles,
 * the institute in numbers, the press and the questions people ask.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params
  const payload = await getPayload({ config })
  const [t, tArticle, tArticles, format, open, articles, stats, outlets, covers, contact, faq] =
    await Promise.all([
      getTranslations('Home'),
      getTranslations('Article'),
      getTranslations('Articles'),
      getFormatter(),
      getOpenNow(payload, locale as Locale),
      getHomeArticles(payload, locale as Locale),
      getHomeStats(payload),
      getPressOutlets(payload, locale as Locale),
      getPublicationCovers(payload),
      getContactForm(payload, locale as Locale),
      getHomeFaq(payload, locale as Locale),
    ])

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
        primary={
          open.length
            ? { label: t('seeOpen'), href: '/#open' }
            : {
                label: t('seeOpen'),
                note: t('noneOpen'),
                link: { label: t('noneOpenLink'), href: '#newsletter' },
              }
        }
        secondary={{ label: t('readArticles'), href: '/articles' }}
        text={t('heroText')}
        title={t('heroTitle')}
        who={t.raw('heroWho') as string[]}
      />

      <div className="home-page">
        {/* With nothing open there is no section; the hero says so instead. */}
        {open.length ? <OpenNow items={open} locale={locale} /> : null}

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

        <StatsBand
          className="home-stats"
          flush
          locale={locale === 'ar' ? 'ar-EG' : 'en-GB'}
          numberingSystem={locale === 'ar' ? 'arab' : 'latn'}
          stats={[
            { value: stats.years, label: t('statYears') },
            { value: stats.courses, label: t('statCourses') },
            { value: stats.fellows, label: t('statFellows') },
          ]}
          title={t('statsTitle')}
        />

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
