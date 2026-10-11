import config from '@payload-config'
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
  RelatedArticles,
  TextSize,
} from '@/components/article/reading-tools'
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

  const [t, tl, format, related] = await Promise.all([
    getTranslations('Article'),
    getTranslations('Language'),
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

  return (
    <article className={`${readingFonts} px-4 pb-24 sm:px-6`} id="article">
      {preview && <RefreshRouteOnSave />}
      <ReadingProgress target="article-text" />

      {/* Running head: where this sits. The language switch is in the site header. */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 border-b border-foreground py-3 font-mono text-[0.7rem] tracking-[0.14em] uppercase"
      >
        <Link className="opacity-60 hover:opacity-100" href="/articles">
          {t('back')}
        </Link>
        {pub && (
          <>
            <span aria-hidden className="opacity-40">
              /
            </span>
            <Link className="opacity-60 hover:opacity-100" href={`/articles?publication=${pub.slug}`}>
              {pub.title}
            </Link>
          </>
        )}
      </nav>

      <header className="pt-14 pb-10 sm:pt-20" dir={contentDir} lang={contentLocale}>
        <h1
          className={`max-w-[18ch] font-serif-reading text-[clamp(2.5rem,7vw,5.75rem)] tracking-[-0.02em] ${isRtl(contentLocale) ? 'leading-[1.25]' : 'leading-[0.98]'}`}
        >
          {title}
        </h1>
      </header>
      <div className="-mt-4 pb-10">
        <p className="text-lg">
          <span className="opacity-60">{t('by')} </span>
          {joinNames(authorNames(article), t('and'))}
        </p>
        {translators.length > 0 && (
          <p className="mt-1 text-sm opacity-70">
            {t('translatedBy')} {joinNames(translators, t('and'))}
          </p>
        )}
      </div>

      {/* Facts strip, ruled like a table. */}
      <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        <Fact label={t('publication')}>{pub?.title ?? '—'}</Fact>
        <Fact label={t('published')}>
          {article.published_date
            ? format.dateTime(new Date(article.published_date), 'year')
            : yearOf(article)}
        </Fact>
        <Fact label={t('readingTime')}>{minutes ? t('minutes', { count: minutes }) : '—'}</Fact>
        <Fact label={t('language')}>{tl(contentLocale)}</Fact>
      </dl>

      {cover?.url && (
        <figure className="mt-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={cover.alt} className="w-full object-cover" src={cover.url} />
        </figure>
      )}

      <div className="mt-12 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        {/* Margin: the contents, sticky beside the text. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {sections.length >= 3 && <ArticleContents container="article-text" sections={sections} />}
          <div className={`flex items-center gap-3 ${sections.length >= 3 ? 'mt-6' : ''}`}>
            <TextSize target="article-text" />
          </div>
        </aside>

        <div className="min-w-0">
          {/* No text in the site language: show the content language, and say so. */}
          {fallback && (
            <p className="mb-8 border-s-2 border-foreground ps-4 text-sm" role="note">
              {(await getTranslations('Fallback'))('onlyIn', { language: tl(contentLocale) })}
            </p>
          )}

          <div dir={contentDir} id="article-text" lang={contentLocale}>
            {text ? (
              <RichTextField className="article-prose" data={text} />
            ) : (
              <p className="font-serif-reading text-xl opacity-60">—</p>
            )}

            {notes && (
              <div className="article-notes mt-14 max-w-[68ch]">
                <ArticleNotes title={t('notes', { count: noteCount })}>
                  <RichTextField className="article-prose article-prose--notes" data={notes} />
                </ArticleNotes>
              </div>
            )}
          </div>

          {/* Tools at the end of the text. */}
          <div className="mt-12 flex max-w-[68ch] flex-wrap items-center gap-3 border-t border-border pt-6">
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
            <section className="mt-12 max-w-[68ch] border-t border-foreground pt-4 text-sm">
              <h2 className="font-mono text-[0.7rem] tracking-[0.14em] uppercase">{t('aboutText')}</h2>
              <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {hasOriginal && original && (
                  <div>
                    <dt className="opacity-60">{t('original')}</dt>
                    <dd className="mt-1" dir="auto">
                      {original.original_title && (
                        <span className="block font-serif-reading text-base">{original.original_title}</span>
                      )}
                      {originalAuthors.length > 0 && <span className="block">{joinNames(originalAuthors, t('and'))}</span>}
                      {original.original_source && <span className="block opacity-70">{original.original_source}</span>}
                    </dd>
                  </div>
                )}
                {credits.map((c) => (
                  <div key={c.id ?? c.role}>
                    <dt className="opacity-60">{c.label || t(`roles.${c.role}`)}</dt>
                    <dd className="mt-1">
                      {joinNames(c.people.filter(isObject<Person>).map((p) => p.name), t('and'))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-24 border-t border-foreground pt-4">
          <RelatedArticles
            posts={related.map((r) => toPost(r, locale, format, (m) => t('minutes', { count: m }), t('and')))}
            title={t('related')}
          />
        </div>
      )}
    </article>
  )
}

/** A related article as an Arc blog card. */
const toPost = (
  a: Article,
  locale: Locale,
  format: Awaited<ReturnType<typeof getFormatter>>,
  minutesLabel: (m: number) => string,
  and: string,
) => {
  const image = isObject<Media>(a.cover_image) ? a.cover_image : undefined
  const date = a.published_date ?? a.createdAt
  const minutes = readingMinutes(a)
  const names = authorNames(a)
  return {
    id: String(a.id),
    href: pathOf('articles', a, locale) ?? '#',
    title: a.title,
    excerpt: excerptOf(a, 140),
    category: publicationOf(a)?.title ?? '',
    date: date.slice(0, 10),
    dateLabel: format.dateTime(new Date(date), 'year'),
    readTime: minutes,
    readTimeLabel: minutesLabel(minutes),
    author: { name: joinNames(names, and) },
    ...(image?.url ? { image: { src: image.url, alt: image.alt } } : {}),
  }
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border px-1 py-3 not-last:border-e max-sm:nth-2:border-e-0 max-sm:nth-[-n+2]:border-b">
      <dt className="font-mono text-[0.65rem] tracking-[0.14em] uppercase opacity-60">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}
