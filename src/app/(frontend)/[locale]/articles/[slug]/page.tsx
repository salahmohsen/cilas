import config from '@payload-config'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { getArticleForReading, getRelatedArticles, type Locale } from '@/api/articles.api'
import {
  ArticleContents,
  ArticleNotes,
  ReadingProgress,
  TextSize,
} from '@/components/article/reading-tools'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { toArticleCard } from '@/lib/article-cards'
import grid from '@/components/arc/blocks/blog-grid/blog-grid.module.css'
import { CopyButton } from '@/components/arc/copy-button/copy-button'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { RichTextField } from '@/components/RichTextField'
import { env } from '@/env'
import { Link } from '@/i18n/navigation'
import { isRtl, routing } from '@/i18n/routing'
import { splitBody } from '@/lib/article-body'
import {
  authorNames,
  creditNames,
  excerptOf,
  joinNames,
  publicationOf,
  readingMinutes,
  yearOf,
} from '@/lib/articles'
import { readingFonts } from '@/lib/fonts'
import { pathOf } from '@/lib/paths'
import type { Article, Media, Person } from '@/payload-types'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const revalidate = 3600

const isObject = <T,>(v: unknown): v is T => typeof v === 'object' && v !== null

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'articles',
    where: { _status: { equals: 'published' } },
    limit: 0,
    select: { slug: true },
    depth: 0,
    overrideAccess: false,
  })
  return routing.locales.flatMap((locale) => docs.map((doc) => ({ locale, slug: doc.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const payload = await getPayload({ config })
  const reading = await getArticleForReading(payload, slug, { locale: locale as Locale })
  if (!reading) return {}
  const { article, title, body } = reading
  const metaTitle = article.meta?.title || `${title} — CILAS`
  const description = article.meta?.description || excerptOf({ body }, 160)
  return {
    title: metaTitle,
    description,
    openGraph: { title: metaTitle, description, type: 'article' },
    // Each site language has its own URL (ADR 0006).
    alternates: {
      canonical: pathOf('articles', article, locale),
      languages: Object.fromEntries(routing.locales.map((l) => [l, pathOf('articles', article, l) ?? ''])),
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { locale: siteLocale, slug } = await params
  const locale = siteLocale as Locale
  const { isEnabled: preview } = await draftMode()
  const payload = await getPayload({ config })

  const reading = await getArticleForReading(payload, slug, { locale, preview })
  if (!reading) notFound()
  const { article, contentLocale, body, title } = reading

  const [t, tl, tArticles, format, related] = await Promise.all([
    getTranslations('Article'),
    getTranslations('Language'),
    getTranslations('Articles'),
    getFormatter(),
    getRelatedArticles(payload, article, locale),
  ])
  const { text, notes, noteCount, sections } = splitBody(body)
  const fallback = contentLocale !== locale
  const contentDir = isRtl(contentLocale) ? 'rtl' : 'ltr'
  const pub = publicationOf(article)
  const translators = creditNames(article, 'translator')
  const minutes = readingMinutes({ body })
  const original = article.translation
  const originalAuthors = (original?.original_authors ?? []).filter(isObject<Person>).map((p) => p.name)
  const credits = (article.credits ?? []).filter((c) => c.role !== 'translator' && c.role !== 'author')
  const hasOriginal = Boolean(original?.original_title || original?.original_source)
  const cover = isObject<Media>(article.cover_image) ? article.cover_image : undefined
  const url = `${env.NEXT_PUBLIC_SERVER_URL}${pathOf('articles', article, locale)}`
  // The reader opens with a lead: the article's description when it has one.
  const excerpt = article.meta?.description ?? null

  const authors = joinNames(authorNames(article), t('and'))
  const year = article.published_date ? format.dateTime(new Date(article.published_date), 'year') : yearOf(article)
  const hasContents = sections.length >= 3

  // The layout is Arc's blog-grid reader (blocks/blog-grid): one centred
  // column with a back link, meta line, title, byline, image and body. The
  // reading tools sit around it.
  return (
    <div className={`${grid.root} ${readingFonts}`}>
      {preview && <RefreshRouteOnSave />}
      <ReadingProgress target="article-text" />
      <div className={grid.inner}>
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_760px_minmax(0,1fr)] xl:gap-12">
          {/* Margin: the contents, sticky beside the column on wide screens. */}
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-6">
              {hasContents && <ArticleContents container="article-text" sections={sections} />}
              <TextSize target="article-text" />
            </div>
          </aside>

          <article aria-labelledby="article-title" className={grid.reader}>
            <Link className={grid.back} href={pub ? `/articles?publication=${pub.slug}` : '/articles'}>
              <ArrowLeft aria-hidden className="rtl:-scale-x-100" size={16} />
              {pub?.title ?? t('back')}
            </Link>

            <header className={grid.readerHead} dir={contentDir} lang={contentLocale}>
              <p className={grid.meta} dir={isRtl(locale) ? 'rtl' : 'ltr'} lang={locale}>
                <span>{pub?.title ?? tl(contentLocale)}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={article.published_date ?? article.createdAt}>{year}</time>
              </p>
              <h1 className={`${grid.readerTitle} article-title`} id="article-title">
                {title}
              </h1>
              <div className={grid.byline} dir={isRtl(locale) ? 'rtl' : 'ltr'} lang={locale}>
                <span aria-hidden className={grid.avatar} />
                <span className={grid.authorName}>{authors}</span>
                {minutes > 0 && <span className={grid.readTime}>{t('minutes', { count: minutes })}</span>}
              </div>
              {translators.length > 0 && (
                <p className={grid.meta} dir={isRtl(locale) ? 'rtl' : 'ltr'} lang={locale}>
                  {t('translatedBy')} {joinNames(translators, t('and'))}
                </p>
              )}
            </header>

            {cover?.url && (
              <div className={grid.readerImage}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={cover.alt} className={grid.image} src={cover.url} />
              </div>
            )}

            {/* Narrow screens: the tools fold into the column. */}
            <div className="flex flex-col gap-4 xl:hidden">
              {hasContents && <ArticleContents container="article-text" sections={sections} />}
              <TextSize target="article-text" />
            </div>

            {/* No text in the site language: show the content language, and say so. */}
            {fallback && (
              <p className="border-s-2 border-foreground ps-4 text-sm" role="note">
                {(await getTranslations('Fallback'))('onlyIn', { language: tl(contentLocale) })}
              </p>
            )}

            {/* Not grid.readerBody: its paragraph rules are for short previews and
                would override the essay's measure, size and spacing. */}
            <div className="grid gap-5" dir={contentDir} id="article-text" lang={contentLocale}>
              {excerpt && <p className="article-lead">{excerpt}</p>}
              {text ? (
                <RichTextField className="article-prose" data={text} />
              ) : (
                <p className="opacity-60">—</p>
              )}
              {notes && (
                <div className="mt-6">
                  <ArticleNotes title={t('notes', { count: noteCount })}>
                    <RichTextField className="article-prose article-prose--notes" data={notes} />
                  </ArticleNotes>
                </div>
              )}
            </div>

            {/* Tools at the end of the text. */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
              <CopyButton label={t('copyLink')} value={url} variant="outline" />
              {pub?.print_edition_url && (
                <a
                  className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-[var(--surface-muted)]"
                  href={pub.print_edition_url}
                  rel="noopener"
                  target="_blank"
                >
                  {t('printEdition')}
                </a>
              )}
            </div>

            {/* About this text: provenance and credits, after the essay. */}
            {(hasOriginal || credits.length > 0) && (
              <section className="rounded-[26px] bg-[var(--surface-muted)] p-6 text-sm">
                <h2 className="font-medium">{t('aboutText')}</h2>
                <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {hasOriginal && original && (
                    <div>
                      <dt className="text-[var(--text-muted)]">{t('original')}</dt>
                      <dd className="mt-1" dir="auto">
                        {original.original_title && <span className="block">{original.original_title}</span>}
                        {originalAuthors.length > 0 && <span className="block">{joinNames(originalAuthors, t('and'))}</span>}
                        {original.original_source && (
                          <span className="block text-[var(--text-secondary)]">{original.original_source}</span>
                        )}
                      </dd>
                    </div>
                  )}
                  {credits.map((c) => (
                    <div key={c.id ?? c.role}>
                      <dt className="text-[var(--text-muted)]">{c.label || t(`roles.${c.role}`)}</dt>
                      <dd className="mt-1">
                        {joinNames(c.people.filter(isObject<Person>).map((p) => p.name), t('and'))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </article>
        </div>
      </div>

      {related.length > 0 && (
        <ArticlesGrid
          categories={[]}
          description=""
          pageSize={3}
          posts={related.map((r) =>
            toArticleCard(r, {
              locale,
              format,
              minutesLabel: (m) => t('minutes', { count: m }),
              and: t('and'),
              otherCategory: tArticles('notes'),
            }),
          )}
          showFeatured={false}
          title={t('related')}
        />
      )}
    </div>
  )
}
