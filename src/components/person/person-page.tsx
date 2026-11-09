import { AvatarImage } from '@/components/arc/lib/avatar-image'
import { SocialLinks } from '@/components/person/social-links'
import { isRtl, type Locale, otherLocale } from '@/i18n/routing'
import { personAvatarSeed } from '@/lib/avatar'
import { pathOf } from '@/lib/paths'
import config from '@payload-config'
import { ArrowLeft } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { getCommunityWriting, getContributions, getPerson } from '@/api/people.api'
import grid from '@/components/arc/blocks/blog-grid/blog-grid.module.css'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { Schema } from '@/components/schema'
import { Link } from '@/i18n/navigation'
import { toArticleCard, toCourseCard } from '@/lib/article-cards'
import { focalPointStyle } from '@/lib/media-image'
import { breadcrumbSchema, personSchema } from '@/lib/schema'
import type { Reader } from '@/lib/reader'
import type { Media } from '@/payload-types'

/** A person's page: who they are, and what they have written, translated and taught. */
export async function PersonPage({
  locale: siteLocale,
  slug,
  user,
}: {
  locale: string
  slug: string
  user: Reader
}) {
  const locale = siteLocale as Locale
  const payload = await getPayload({ config })
  const person = await getPerson(payload, slug, locale)
  if (!person) notFound()

  const other: Locale = otherLocale(locale)
  const [t, tArticle, tArticles, tCourse, format, contributions, otherName, tm, community] =
    await Promise.all([
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
      getTranslations('Meta'),
      user ? getCommunityWriting(payload, person.id, locale, user) : [],
    ])
  // Where the page sits on the site: home, then this person.
  const crumbs = breadcrumbSchema([
    { name: tm('siteName'), path: '/' },
    { name: person.name, path: pathOf('people', person, locale) },
  ])
  const photo =
    typeof person.photo === 'object' && person.photo ? (person.photo as Media) : undefined
  const { written, credited, taught } = contributions
  const nothing = !written.length && !credited.length && !taught.length && !community.length
  const card = (a: (typeof written)[number]) =>
    toArticleCard(a, {
      locale,
      format,
      minutesLabel: (m) => tArticle('minutes', { count: m }),
      and: tArticle('and'),
      otherCategory: tArticles('notes'),
    })

  return (
    <div className={grid.root}>
      {/* The person, as data a search engine reads. */}
      <Schema data={[personSchema({ person, locale }), crumbs]} />
      <div className={grid.inner}>
        <div className={grid.reader}>
          <Link className={grid.back} href="/articles">
            <ArrowLeft aria-hidden className="rtl:-scale-x-100" size={16} />
            {tArticle('back')}
          </Link>

          {/* Who they are. */}
          <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="size-36 shrink-0 overflow-hidden rounded-[26px] bg-[var(--surface-muted)] sm:size-44">
              <AvatarImage
                src={photo?.url}
                fallbackSeed={personAvatarSeed(person.id)}
                alt={photo?.alt || person.name}
                className="h-full w-full object-cover"
                style={focalPointStyle(photo)}
              />
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
              <SocialLinks person={person} websiteLabel={t('website')} />
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
      {community.length > 0 && (
        <ArticlesGrid
          categories={[]}
          description=""
          pageSize={6}
          posts={community.map(card)}
          showFeatured={false}
          title={t('community')}
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
