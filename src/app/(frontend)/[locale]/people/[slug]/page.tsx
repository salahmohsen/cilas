import config from '@payload-config'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { getPublicationCovers, type Locale } from '@/api/articles.api'
import { getContributions, getPerson } from '@/api/people.api'
import { ArticlesGrid } from '@/components/article/articles-grid'
import grid from '@/components/arc/blocks/blog-grid/blog-grid.module.css'
import { RichTextField } from '@/components/RichTextField'
import { Link } from '@/i18n/navigation'
import { isRtl, routing } from '@/i18n/routing'
import { toArticleCard, toCourseCard } from '@/lib/article-cards'
import { readingFonts } from '@/lib/fonts'
import { pathOf } from '@/lib/paths'
import type { Media } from '@/payload-types'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const revalidate = 3600

const SOCIAL: Record<string, string> = {
  facebook: 'Facebook',
  x: 'X',
  youtube: 'YouTube',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const payload = await getPayload({ config })
  const person = await getPerson(payload, slug, locale as Locale)
  if (!person) return {}
  return {
    title: `${person.name} — CILAS`,
    alternates: {
      canonical: pathOf('people', person, locale),
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, pathOf('people', person, l) ?? '']),
      ),
    },
  }
}

/** A person's page: who they are, and what they have written, translated and taught. */
export default async function PersonPage({ params }: Props) {
  const { locale: siteLocale, slug } = await params
  const locale = siteLocale as Locale
  const payload = await getPayload({ config })
  const person = await getPerson(payload, slug, locale)
  if (!person) notFound()

  const other: Locale = locale === 'ar' ? 'en' : 'ar'
  const publicationCovers = await getPublicationCovers(payload)
  const [t, tArticle, tArticles, tCourse, format, contributions, otherName] = await Promise.all([
    getTranslations('Person'),
    getTranslations('Article'),
    getTranslations('Articles'),
    getTranslations('Course'),
    getFormatter(),
    getContributions(payload, person.id, locale),
    payload
      .findByID({
        collection: 'people',
        id: person.id,
        locale: other,
        fallbackLocale: false,
        depth: 0,
        select: { name: true },
      })
      .then((p) => p?.name ?? null)
      .catch(() => null),
  ])
  const photo =
    typeof person.photo === 'object' && person.photo ? (person.photo as Media) : undefined
  const { written, credited, taught } = contributions
  const nothing = !written.length && !credited.length && !taught.length
  const card = (a: (typeof written)[number]) =>
    toArticleCard(a, {
      locale,
      format,
      minutesLabel: (m) => tArticle('minutes', { count: m }),
      and: tArticle('and'),
      otherCategory: tArticles('notes'),
      publicationCovers,
    })

  return (
    <div className={`${grid.root} ${readingFonts}`}>
      <div className={grid.inner}>
        <div className={grid.reader}>
          <Link className={grid.back} href="/articles">
            <ArrowLeft aria-hidden className="rtl:-scale-x-100" size={16} />
            {tArticle('back')}
          </Link>

          {/* Who they are. */}
          <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="size-36 shrink-0 overflow-hidden rounded-[26px] bg-[var(--surface-muted)] sm:size-44">
              {photo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={photo.alt || person.name}
                  className="h-full w-full object-cover"
                  src={photo.url}
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-full w-full items-center justify-center text-5xl font-medium text-[var(--text-muted)]"
                >
                  {person.name.trim().charAt(0)}
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <h1 className={grid.readerTitle}>{person.name}</h1>
              {otherName && otherName !== person.name && (
                <p
                  className="text-lg text-[var(--text-secondary)]"
                  dir={isRtl(other) ? 'rtl' : 'ltr'}
                  lang={other}
                >
                  {otherName}
                </p>
              )}
              {Boolean(person.website || person.social_links?.length) && (
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {person.website && (
                    <a
                      className="underline underline-offset-4"
                      href={person.website}
                      rel="noopener"
                      target="_blank"
                    >
                      {t('website')}
                    </a>
                  )}
                  {person.social_links?.map((s) => (
                    <a
                      className="underline underline-offset-4"
                      href={s.url}
                      key={s.id ?? s.url}
                      rel="noopener"
                      target="_blank"
                    >
                      {SOCIAL[s.platform] ?? s.platform}
                    </a>
                  ))}
                </p>
              )}
            </div>
          </header>

          {person.bio?.root?.children?.length ? (
            <RichTextField className="article-prose article-prose--bio" data={person.bio} />
          ) : null}

          {nothing && <p className="text-[var(--text-muted)]">{t('nothing')}</p>}
        </div>
      </div>

      {/* What they wrote, worked on and taught, as Arc blog cards. */}
      {written.length > 0 && (
        <ArticlesGrid
          categories={[]}
          description=""
          pageSize={6}
          posts={written.map(card)}
          showFeatured={false}
          title={t('written')}
        />
      )}
      {credited.length > 0 && (
        <ArticlesGrid
          categories={[]}
          description=""
          pageSize={6}
          posts={credited.map(({ article, role, label }) => ({
            ...card(article),
            id: `${article.id}-${role}`,
            category: label || tArticle(`roles.${role}`),
          }))}
          showFeatured={false}
          title={t('credited')}
        />
      )}
      {taught.length > 0 && (
        <ArticlesGrid
          categories={[]}
          description=""
          pageSize={6}
          posts={taught.map((c) =>
            toCourseCard(c, {
              locale,
              format,
              weeksLabel: (w) => tCourse('weeks', { count: w }),
              and: tArticle('and'),
            }),
          )}
          showFeatured={false}
          title={t('taught')}
        />
      )}
    </div>
  )
}
