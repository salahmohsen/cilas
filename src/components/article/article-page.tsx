import config from '@payload-config'
import { VisualEditing } from '@payload-inline-visual-editor/react'
import { ArrowLeft, ArrowUpRight, Languages } from 'lucide-react'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import {
  getArticleCollection,
  getArticleForReading,
  getPublicationCovers,
  getRelatedArticles,
  type Locale,
  type Reader,
} from '@/api/articles.api'
import {
  ArticleContents,
  ArticleNotes,
  ReadingProgress,
  TextSize,
} from '@/components/article/reading-tools'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { toArticleCard } from '@/lib/article-cards'
import grid from '@/components/arc/blocks/blog-grid/blog-grid.module.css'
import { EditorFields, labelOf } from '@/components/editor-fields'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { ContributorList, PersonLink, type Contributor } from '@/components/person/contributors'
import { RichTextField } from '@/components/RichTextField'
import { ShareBar } from '@/components/share-bar'
import { OrbitCardStack } from '@/components/ui/orbit-card-stack'
import { Link } from '@/i18n/navigation'
import { isRtl, routing } from '@/i18n/routing'
import { env } from '@/env'
import { splitBody } from '@/lib/article-body'
import { localDigits } from '@/lib/digits'
import { editableIn } from '@/lib/editable'
import { footnotesOf } from '@/lib/footnotes'
import { excerptOf, publicationOf, readingMinutes, repeatsOpening, yearOf } from '@/lib/articles'
import { ogImages } from '@/lib/og'
import { pathOf } from '@/lib/paths'
import type { Article, Media, Person, Publication } from '@/payload-types'

const isObject = <T,>(v: unknown): v is T => typeof v === 'object' && v !== null

/** Which article, and who reads it (null: an anonymous visitor). */
type View = { locale: string; slug: string; user: Reader }

/** The page metadata. Shared by the cached page and the signed-in one. */
export async function articleMetadata({ locale, slug, user }: View): Promise<Metadata> {
  const payload = await getPayload({ config })
  const reading = await getArticleForReading(payload, slug, { locale: locale as Locale, user })
  if (!reading) return {}
  const { article, title, body } = reading
  const metaTitle = article.meta?.title || `${title} — CILAS`
  // The SEO image, else the article's cover; the site's default otherwise.
  const media = (v: unknown) => (isObject<Media>(v) && v.url ? v.url : null)
  const image = media(article.meta?.image) ?? media(article.cover_image)
  const description = article.meta?.description || excerptOf({ body }, 160)
  return {
    title: metaTitle,
    description,
    openGraph: { title: metaTitle, description, type: 'article', images: ogImages(image) },
    twitter: { card: 'summary_large_image', images: ogImages(image).map((i) => i.url) },
    // Each site language has its own URL (ADR 0006).
    alternates: {
      canonical: pathOf('articles', article, locale),
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, pathOf('articles', article, l) ?? '']),
      ),
    },
  }
}

/**
 * One article. The cached page renders it for anonymous visitors; the
 * signed-in page (src/proxy.ts sends signed-in readers there) passes the
 * account, so `community` articles open too.
 */
export async function ArticlePage({ locale: siteLocale, slug, user }: View) {
  const locale = siteLocale as Locale
  const { isEnabled: preview } = await draftMode()
  // In the admin's live preview, mark the fields for the visual editor.
  const pe = editableIn(preview)
  const payload = await getPayload({ config })

  const reading = await getArticleForReading(payload, slug, { locale, preview, user })
  if (!reading) notFound()
  const { article, contentLocale, body, title, other } = reading

  const publicationCovers = await getPublicationCovers(payload)
  const [t, tl, tArticles, tShare, format, collection] = await Promise.all([
    getTranslations('Article'),
    getTranslations('Language'),
    getTranslations('Articles'),
    getTranslations('Share'),
    getFormatter(),
    getArticleCollection(payload, article, locale, user),
  ])
  // A collection's article ends with the whole collection, in its order;
  // any other article with related ones.
  const related = collection ? [] : await getRelatedArticles(payload, article, locale, 3, user)
  const card = (a: Article) =>
    toArticleCard(a, {
      locale,
      format,
      minutesLabel: (m) => t('minutes', { count: m }),
      and: t('and'),
      otherCategory: tArticles('notes'),
      publicationCovers,
    })
  const { text, notes, noteCount, sections } = splitBody(body)
  const footnotes = footnotesOf(text)
  const fallback = contentLocale !== locale
  const contentDir = isRtl(contentLocale) ? 'rtl' : 'ltr'
  const pub = publicationOf(article)
  const minutes = readingMinutes({ body })
  const original = article.translation
  const hasOriginal = Boolean(original?.original_title || original?.original_source)
  // "English" / "الإنجليزية": the original's language, named in the site language.
  const originalLanguage =
    original?.original_language && original.original_language !== 'other'
      ? new Intl.DisplayNames([locale], { type: 'language' }).of(original.original_language)
      : undefined

  // People, named in the site language; a name missing there comes from the
  // article's other-language copy.
  const otherPeople = new Map<number, Person>()
  for (const p of [
    ...(other?.authors ?? []),
    ...(other?.credits ?? []).flatMap((c) => c.people),
    ...(other?.translation?.original_authors ?? []),
  ])
    if (isObject<Person>(p)) otherPeople.set(p.id, p)
  const named = (p: Person): Person =>
    p.name ? p : { ...p, name: otherPeople.get(p.id)?.name ?? p.slug }
  const peopleOf = (xs: Array<number | Person> | null | undefined) =>
    (xs ?? []).filter(isObject<Person>).map(named)
  const writers = peopleOf(article.authors)
  const originalAuthors = peopleOf(original?.original_authors)
  // The sidebar: writers, then translators and every other credit.
  const contributors: Contributor[] = []
  const add = (person: Person, role: string) => {
    if (!contributors.some((c) => c.person.id === person.id && c.role === role))
      contributors.push({ person, role })
  }
  for (const w of writers) add(w, t('roles.author'))
  for (const c of article.credits ?? [])
    for (const p of peopleOf(c.people)) add(p, c.label || t(`roles.${c.role}`))
  const cover = isObject<Media>(article.cover_image) ? article.cover_image : undefined
// The reader opens with a lead: the article's description when it has
// one, in its words and not the body's opening said twice.
const excerpt =
  article.meta?.description && !repeatsOpening(article.meta.description, body)
    ? article.meta.description
    : null

  const year = article.published_date
    ? format.dateTime(new Date(article.published_date), 'year')
    : localDigits(yearOf(article), locale)
  const hasContents = sections.length >= 3

  // The layout is Arc's blog-grid reader (blocks/blog-grid): one centred
  // column with a back link, meta line, title, byline, image and body. The
  // reading tools sit around it.
  return (
    <div className={grid.root}>
      {preview && (
        <>
          <RefreshRouteOnSave />
          <VisualEditing draft serverURL={env.NEXT_PUBLIC_SERVER_URL} />
        </>
      )}
      <ReadingProgress target="article-text" />
      <div className={grid.inner}>
        <div className="xl:grid xl:grid-cols-[17rem_minmax(0,760px)] xl:justify-center xl:gap-16">
          {/* Margin: the contents, sticky beside the column on wide screens. */}
          <aside className="hidden xl:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-10 overflow-y-auto pe-2">
              <div {...pe('authors')}>
                <ContributorList contributors={contributors} title={t('people')} />
              </div>
              {hasContents && <ArticleContents container="article-text" sections={sections} />}
              <TextSize target="article-text" />
            </div>
          </aside>

          <article
            aria-labelledby="article-title"
            className={grid.reader}
            {...pe.scope({ collection: 'articles', id: article.id })}
          >
            {preview ? (
              <EditorFields
                pe={pe}
                fields={[
                  { label: 'Visibility', path: 'tier', value: article.tier },
                  { label: 'Slug', path: 'slug', value: article.slug },
                  { label: 'Featured', path: 'featured', value: article.featured ? 'Yes' : 'No' },
                  { label: 'Tags', path: 'tags', value: article.tags?.map((x) => x.tag).join(', ') },
                  { label: 'Related articles', path: 'related_articles', value: article.related_articles?.map(labelOf).join(', ') },
                  { label: 'Original language', path: 'translation.original_language', value: article.translation?.original_language },
                  { label: 'Original title', path: 'translation.original_title', value: article.translation?.original_title },
                  { label: 'Original authors', path: 'translation.original_authors', value: article.translation?.original_authors?.map(labelOf).join(', ') },
                  { label: 'Original source', path: 'translation.original_source', value: article.translation?.original_source },
                  { label: 'SEO title', path: 'meta.title', value: article.meta?.title },
                  { label: 'SEO description', path: 'meta.description', value: article.meta?.description },
                  { label: 'SEO image', path: 'meta.image', value: labelOf(article.meta?.image) },
                ]}
              />
            ) : null}
            <Link
              className={grid.back}
              href={pub ? `/articles?publication=${pub.slug}` : '/articles'}
            >
              <ArrowLeft aria-hidden className="rtl:-scale-x-100" size={16} />
              {pub?.title ?? t('back')}
            </Link>

            <header className={grid.readerHead} dir={contentDir} lang={contentLocale}>
              <p className={grid.meta} dir={isRtl(locale) ? 'rtl' : 'ltr'} lang={locale}>
                <span>{pub?.title ?? tl(contentLocale)}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={article.published_date ?? article.createdAt} {...pe('published_date')}>
                  {year}
                </time>
                {minutes > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t('minutes', { count: minutes })}</span>
                  </>
                )}
              </p>
              <h1 className={`${grid.readerTitle} article-title`} id="article-title" {...pe('title')}>
                {title}
              </h1>
            </header>

            {cover?.url && (
              <div className={`${grid.readerImage} article-cover`} {...pe('cover_image')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={cover.alt} className={`${grid.image} article-cover-image`} src={cover.url} />
              </div>
            )}

            {/* Narrow screens: the tools fold into the column. */}
            <div className="flex flex-col gap-6 xl:hidden" {...pe('authors')}>
              <ContributorList contributors={contributors} title={t('people')} />
              {hasContents && <ArticleContents container="article-text" sections={sections} />}
              <TextSize target="article-text" />
            </div>

            {/* No text in the site language: show the content language, and say so. */}
            {fallback && (
              <p className="border-s-2 border-foreground ps-4 text-sm" role="note">
                {(await getTranslations('Fallback'))('onlyIn', { language: tl(contentLocale) })}
              </p>
            )}

            {/* The introduction opens onto the collection it introduces. */}
            {collection?.isForeword && (
              <OrbitCardStack
                // Desktop only: on a phone the fan has no room, and the
                // collection is listed at the end of the article anyway.
                className="hidden overflow-x-clip p-0 lg:flex xl:overflow-visible"
                dir={isRtl(locale) ? 'rtl' : 'ltr'}
                items={collection.articles
                  .filter((a) => a.id !== article.id)
                  .map((a, i, rest) => {
                    const c = card(a)
                    return {
                      name: c.title,
                      role: c.author.name,
                      description: c.excerpt,
                      href: pathOf('articles', a) ?? '#',
                      ...(c.image ? { image: c.image.src, imageAlt: c.image.alt } : {}),
                      stat: t('essayOf', { n: i + 1, total: rest.length }),
                    }
                  })}
                label={t('collectionStack', { title: collection.publication.title })}
                spread={Math.min(150, 380 / Math.max(1, collection.articles.length - 2))}
              />
            )}

            {/* Not grid.readerBody: its paragraph rules are for short previews and
                would override the essay's measure, size and spacing. */}
            <div className="grid gap-5" dir={contentDir} id="article-text" lang={contentLocale}>
              {excerpt && <p className="article-lead">{excerpt}</p>}
              {text ? (
                <div {...pe('body')}>
                  <RichTextField
                    className="article-prose"
                    data={text}
                    footnoteLabel={t('footnote')}
                    footnotes={footnotes}
                  />
                </div>
              ) : (
                <p className="opacity-60">—</p>
              )}
              {/* Footnotes written in the editor, numbered as marked in the text. */}
              {footnotes.length > 0 && (
                <section
                  aria-labelledby="footnotes-title"
                  className="mt-10 border-t border-border pt-6"
                >
                  <h2 className="mb-4 text-base font-medium" id="footnotes-title">
                    {t('footnotes')}
                  </h2>
                  <ol className="article-footnotes">
                    {footnotes.map((f) => (
                      <li id={`fn-${f.number}`} key={f.id}>
                        <span className="footnote-number">{f.number}</span>
                        <RichTextField
                          className="article-prose article-prose--notes"
                          data={f.note}
                        />
                        <a
                          aria-label={t('backToText')}
                          className="footnote-back"
                          href={`#fnref-${f.number}`}
                        >
                          ↩
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
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
            <section
              aria-labelledby="article-share"
              className="mt-2 grid gap-3 border-t border-border pt-6"
            >
              <h2 className="font-sans text-sm text-[var(--text-muted)]" id="article-share">
                {tShare('heading')}
              </h2>
              <ShareBar
                file={
                  pub?.print_edition_url
                    ? { href: pub.print_edition_url, label: t('printEdition'), kind: 'print' }
                    : undefined
                }
                label={tShare('article')}
                path={pathOf('articles', article, locale) ?? ''}
                title={title}
              />
            </section>

            {/* The original this text translates, with a way to read it. */}
            {hasOriginal && original && (
              <OriginalCard
                authors={<PeopleLinks and={t('and')} people={originalAuthors} />}
                hasAuthors={originalAuthors.length > 0}
                labels={{
                  from: originalLanguage
                    ? t('translatedFrom', { language: originalLanguage })
                    : t('translation'),
                  read: t('readOriginal'),
                }}
                language={
                  original.original_language && original.original_language !== 'other'
                    ? original.original_language
                    : undefined
                }
                source={original.original_source}
                title={original.original_title}
                url={original.original_url}
              />
            )}

            {collection && (
              <CollectionList
                current={article.id}
                labels={{
                  title: t('inCollection'),
                  current: t('readingNow'),
                  foreword: t('foreword'),
                }}
                locale={locale}
                publication={collection.publication}
                items={collection.articles.map((a) => ({
                  id: a.id,
                  title: card(a).title,
                  authors: card(a).author.name,
                  href: pathOf('articles', a) ?? '#',
                  foreword: collection.publication.foreword
                    ? (typeof collection.publication.foreword === 'object'
                        ? collection.publication.foreword.id
                        : collection.publication.foreword) === a.id
                    : false,
                }))}
              />
            )}
          </article>
        </div>
      </div>

      {related.length > 0 && (
        <ArticlesGrid
          categories={[]}
          description=""
          pageSize={3}
          posts={related.map(card)}
          showFeatured={false}
          title={t('related')}
        />
      )}
    </div>
  )
}

/**
 * A collection's articles in their order, the open one marked: the end of
 * every article that belongs to one.
 */
function CollectionList({
  publication,
  items,
  current,
  labels,
  locale,
}: {
  publication: Publication
  items: Array<{ id: number; title: string; authors: string; href: string; foreword: boolean }>
  current: number
  labels: { title: string; current: string; foreword: string }
  locale: string
}) {
  return (
    <nav aria-labelledby="collection-title" className="mt-6 border-t border-border pt-8">
      <p className="text-sm text-[var(--text-muted)]">{labels.title}</p>
      <h2 className="mt-1 text-xl font-semibold" id="collection-title">
        <Link
          className="underline-offset-4 hover:underline"
          href={`/articles?publication=${publication.slug}`}
        >
          {publication.title}
        </Link>
      </h2>
      <ol className="collection-list mt-5">
        {items.map((item, i) => {
          const here = item.id === current
          const body = (
            <>
              <span
                aria-label={item.foreword ? labels.foreword : undefined}
                className="collection-number"
              >
                {item.foreword
                  ? '—'
                  : localDigits(String(i + (items[0]?.foreword ? 0 : 1)).padStart(2, '0'), locale)}
              </span>
              <span className="min-w-0">
                <span className="block font-medium" dir="auto">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">
                  {[item.authors || null, here ? labels.current : null].filter(Boolean).join(' · ')}
                </span>
              </span>
            </>
          )
          return (
            <li key={item.id}>
              {here ? (
                <span aria-current="page" className="collection-item" data-current>
                  {body}
                </span>
              ) : (
                <Link className="collection-item" href={item.href}>
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Names, each linking to its person's page: "A", "A and B", "A, B and C". */
function PeopleLinks({ people, and }: { people: Person[]; and: string }) {
  return (
    <>
      {people.map((p, i) => (
        <span key={p.id}>
          {i > 0 && (i === people.length - 1 ? ` ${and} ` : ', ')}
          <PersonLink person={p} />
        </span>
      ))}
    </>
  )
}

/**
 * "Translated from English": the original's title in its own language and
 * direction (linked when we know where it lives), its authors (to their
 * pages), its source, and a button to read it.
 */
function OriginalCard({
  title,
  authors,
  hasAuthors,
  source,
  url,
  language,
  labels,
}: {
  title?: string | null
  authors: React.ReactNode
  hasAuthors: boolean
  source?: string | null
  url?: string | null
  language?: string
  labels: { from: string; read: string }
}) {
  const external = { rel: 'noopener', target: '_blank' } as const
  return (
    <aside className="relative overflow-hidden rounded-[26px] border border-border bg-[var(--surface-muted)] p-6 sm:p-8">
      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.08em] text-[var(--text-muted)] uppercase rtl:tracking-normal">
        <Languages aria-hidden size={14} />
        {labels.from}
      </p>
      {title && (
        // Its own direction for the words, the card's edge for alignment.
        <p
          className="mt-4 font-heading text-2xl leading-snug text-balance rtl:text-right"
          dir="auto"
          lang={language}
        >
          {url ? (
            <a
              className="underline decoration-1 underline-offset-4 hover:decoration-2"
              href={url}
              {...external}
            >
              {title}
            </a>
          ) : (
            title
          )}
        </p>
      )}
      {(hasAuthors || source) && (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {hasAuthors && <span className="text-[var(--foreground)]">{authors}</span>}
          {hasAuthors && source && <span aria-hidden> · </span>}
          {source && (
            <span dir="auto" lang={language}>
              {source}
            </span>
          )}
        </p>
      )}
      {url && (
        <a
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-full bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-85"
          href={url}
          {...external}
        >
          {labels.read}
          <ArrowUpRight aria-hidden className="rtl:-scale-x-100" size={15} />
        </a>
      )}
    </aside>
  )
}
