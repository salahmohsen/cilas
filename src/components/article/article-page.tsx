import config from '@payload-config'
import { VisualEditing } from '@payload-inline-visual-editor/react'
import { ArrowLeft, ArrowUpRight, Languages } from 'lucide-react'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { draftMode } from 'next/headers'
import { currentReader } from '@/lib/reader'
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
import { getContactEmail } from '@/api/contact.api'
import {
  ArticleContents,
  ArticleNotes,
  ReadingProgress,
  TextSize,
} from '@/components/article/reading-tools'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { toArticleCard } from '@/lib/article-cards'
import grid from '@/components/arc/blocks/blog-grid/blog-grid.module.css'
import { AdminFrameOnly, OutsideAdminFrame } from '@/components/admin-frame-only'
import { EditorFields, labelOf } from '@/components/editor-fields'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { ContributorRows, PersonLink, type Contributor } from '@/components/person/contributors'
import { SideCard, SideCardSection } from '@/components/side-card'
import { ScrollArea } from '@/components/arc/scroll-area/scroll-area'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { ShareBar } from '@/components/share-bar'
import { StudyWithAI } from '@/components/study-with-ai'
import { ArticleCardStack } from '@/components/article/article-card-stack'
import { ArticleCardGrid } from '@/components/article/article-card-grid'
import { CollectionDialog } from '@/components/article/collection-dialog'
import { mediaImage } from '@/lib/media-image'
import { resolveCardStacks } from '@/api/card-stacks.api'
import { NewsletterSignupEnd } from '@/components/newsletter-signup-end'
import { Schema } from '@/components/schema'
import { Link } from '@/i18n/navigation'
import { isRtl } from '@/i18n/routing'
import { env } from '@/env'
import { splitBody } from '@/lib/article-body'
import { localDigits } from '@/lib/digits'
import { editableIn } from '@/lib/editable'
import { footnotesOf } from '@/lib/footnotes'
import { excerptOf, publicationOf, readingMinutes, repeatsOpening, yearOf } from '@/lib/articles'
import { articleSchema, absoluteUrl, breadcrumbSchema } from '@/lib/schema'
import { ogImages } from '@/lib/og'
import { pathOf } from '@/lib/paths'
import { pageAlternates } from '@/lib/seo'
import type { Article, Media, Person } from '@/payload-types'

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
    alternates: pageAlternates(`/articles/${article.slug}`, locale),
  }
}

/**
 * One article. The cached page renders it for anonymous visitors; the
 * signed-in page (src/proxy.ts sends signed-in readers there) passes the
 * account, so `community` articles open too.
 */
export async function ArticlePage({ locale: siteLocale, slug, user: reader }: View) {
  const locale = siteLocale as Locale
  const { isEnabled: preview } = await draftMode()
  const user = preview ? await currentReader() : reader
  // In the admin's live preview, mark the fields for the visual editor.
  const pe = editableIn(preview)
  const payload = await getPayload({ config })

  const reading = await getArticleForReading(payload, slug, { locale, preview, user })
  if (!reading) notFound()
  const { article, contentLocale, body, title, other } = reading

  const publicationCovers = await getPublicationCovers(payload)
  // The institute's email, the share bar's mail recipient.
  const email = await getContactEmail()
  const [t, tl, tArticles, tShare, format, collection, tf, tm] = await Promise.all([
    getTranslations('Article'),
    getTranslations('Language'),
    getTranslations('Articles'),
    getTranslations('Share'),
    getFormatter(),
    getArticleCollection(payload, article, locale, user),
    getTranslations('Study.filters'),
    getTranslations('Meta'),
  ])
  // A collection's article shows its editor's picks, else the rest of its
  // collection, in order; any other article its related ones.
  const picks = article.related_articles?.length ?? 0
  const related = !collection
    ? await getRelatedArticles(payload, article, locale, 3, user)
    : picks > 0
      ? await getRelatedArticles(payload, article, locale, picks, user)
      : collection.articles.filter((a) => a.id !== article.id)
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
  // The Card stack blocks in the text, loaded before it is drawn.
  const stacks = await resolveCardStacks(payload, text, {
    locale,
    user,
    current: article.id,
    articleItem: (a, i, total) => {
      const c = card(a)
      return {
        name: c.title,
        role: c.author.name,
        description: c.excerpt,
        href: pathOf('articles', a) ?? '#',
        ...(c.image
          ? {
              image: c.image.src,
              imageAlt: c.image.alt,
              imageFocalPoint: { focalX: c.image.focalX, focalY: c.image.focalY },
            }
          : {}),
        stat: t('essayOf', { n: i + 1, total }),
      }
    },
    articleCard: card,
    labels: {
      collection: (title) => t('collectionStack', { title }),
      articles: t('stackArticles'),
      courses: t('stackCourses'),
      courseType: (type) => tf(`types.${type.toLowerCase()}`),
    },
  })
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
  // What a search engine reads (JSON-LD): the same facts the page shows —
  // the cover, the SEO description or the opening's excerpt, the writers.
  const metaImage = isObject<Media>(article.meta?.image) ? article.meta.image : cover
  const schema = articleSchema({
    article,
    locale,
    inLanguage: contentLocale,
    title,
    description: article.meta?.description || excerptOf({ body }, 160),
    image: metaImage?.url ? absoluteUrl(metaImage.url) : null,
    authors: writers,
    publisherName: tm('siteName'),
  })
  // Where the article sits on the site: home, the collection, the article.
  const crumbs = breadcrumbSchema([
    { name: tm('siteName'), path: '/' },
    { name: tArticles('title'), path: `/${locale}/articles` },
    { name: title, path: pathOf('articles', article, locale) },
  ])
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

  const articlePath = pathOf('articles', article, locale) ?? ''
  const printEdition = pub?.print_edition_url
    ? { href: pub.print_edition_url, label: t('printEdition'), kind: 'print' as const }
    : undefined
  const aiSteps = tShare.raw('aiSteps') as string[]

  // The side card: its collection, who made it, its sections, and the text
  // size; on wide screens also sharing and Discuss it with AI, which narrow
  // screens keep at the end of the text.
  // On wide screens the card fits the window: only the people list shrinks,
  // and it scrolls when it is long.
  const sideCard = (narrow: boolean) => (
    <SideCard className={narrow ? undefined : 'min-h-0'}>
      {collection && (
        <SideCardSection label={t('inCollection')}>
          <CollectionDialog
            cover={mediaImage(
              publicationCovers.get(collection.publication.id) ??
                (typeof collection.publication.cover_image === 'object'
                  ? collection.publication.cover_image
                  : null),
            )}
            current={article.id}
            href={`/articles?publication=${collection.publication.slug}`}
            labels={{
              kicker: t('inCollection'),
              current: t('readingNow'),
              count: t('collectionCount', {
                count: collection.articles.length,
                n: localDigits(String(collection.articles.length), locale),
              }),
              all: t('collectionAll'),
            }}
            locale={locale}
            title={collection.publication.title}
            items={collection.articles.map((a) => ({
              id: a.id,
              title: card(a).title,
              authors: card(a).author.name,
              href: pathOf('articles', a) ?? '#',
            }))}
            closeLabel={t('closeCollection')}
          />
        </SideCardSection>
      )}
      {contributors.length > 0 && (
        <div className={narrow ? undefined : 'side-card-grow'} {...pe('authors')}>
          <SideCardSection label={t('people')}>
            {narrow ? (
              <ContributorRows contributors={contributors} />
            ) : (
              <ScrollArea label={t('people')}>
                <ContributorRows contributors={contributors} />
              </ScrollArea>
            )}
          </SideCardSection>
        </div>
      )}
      {hasContents && (
        <SideCardSection fold={narrow} label={narrow ? t('contents') : t('onThisPage')}>
          <ArticleContents bare container="article-text" sections={sections} />
        </SideCardSection>
      )}
      <SideCardSection label={t('textSize')}>
        <TextSize cells target="article-text" />
      </SideCardSection>
      {!narrow && (
        <>
          <SideCardSection label={tShare('heading')}>
            <div className="side-card-body side-card-center side-card-scroll">
              <ShareBar
                email={email}
                file={printEdition}
                label={tShare('article')}
                path={articlePath}
                title={title}
              />
            </div>
          </SideCardSection>
          <SideCardSection label={tShare('aiHeading')}>
            <div className="side-card-body side-card-center">
              <StudyWithAI kind="article" path={articlePath} />
              <ol className="grid list-inside list-decimal gap-1 text-xs leading-relaxed side-card-muted">
                {aiSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </SideCardSection>
        </>
      )}
    </SideCard>
  )

  // The layout is Arc's blog-grid reader (blocks/blog-grid): one centred
  // column with a back link, meta line, title, byline, image and body. The
  // reading tools sit around it.
  return (
    <div className={grid.root}>
      {preview && (
        <AdminFrameOnly>
          <RefreshRouteOnSave />
          <VisualEditing draft serverURL={env.NEXT_PUBLIC_SERVER_URL} />
        </AdminFrameOnly>
      )}
      <ReadingProgress target="article-text" />
      {/* The article itself, as data a search engine reads. */}
      <Schema data={[schema, crumbs]} />
      <div className={grid.inner}>
        <div className="xl:grid xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-16">
          {/* Margin: the contents, sticky beside the column on wide screens. */}
          <aside className="hidden xl:block">
            <div className="sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col overflow-y-auto">
              {sideCard(false)}
            </div>
          </aside>

          <article
            aria-labelledby="article-title"
            className={`${grid.reader} article-reader prose-frame`}
            {...pe.scope({ collection: 'articles', id: article.id })}
          >
            {preview ? (
              <AdminFrameOnly>
                <EditorFields
                  pe={pe}
                  fields={[
                    { label: 'Visibility', path: 'tier', value: article.tier },
                    { label: 'Slug', path: 'slug', value: article.slug },
                    { label: 'Featured', path: 'featured', value: article.featured ? 'Yes' : 'No' },
                    {
                      label: 'Tags',
                      path: 'tags',
                      value: article.tags?.map((x) => x.tag).join(', '),
                    },
                    {
                      label: 'Related articles',
                      path: 'related_articles',
                      value: article.related_articles?.map(labelOf).join(', '),
                    },
                    {
                      label: 'Original language',
                      path: 'translation.original_language',
                      value: article.translation?.original_language,
                    },
                    {
                      label: 'Original title',
                      path: 'translation.original_title',
                      value: article.translation?.original_title,
                    },
                    {
                      label: 'Original authors',
                      path: 'translation.original_authors',
                      value: article.translation?.original_authors?.map(labelOf).join(', '),
                    },
                    {
                      label: 'Original source',
                      path: 'translation.original_source',
                      value: article.translation?.original_source,
                    },
                    { label: 'SEO title', path: 'meta.title', value: article.meta?.title },
                    {
                      label: 'SEO description',
                      path: 'meta.description',
                      value: article.meta?.description,
                    },
                    { label: 'SEO image', path: 'meta.image', value: labelOf(article.meta?.image) },
                  ]}
                />
              </AdminFrameOnly>
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
                <time
                  dateTime={article.published_date ?? article.createdAt}
                  {...pe('published_date')}
                >
                  {year}
                </time>
                {minutes > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t('minutes', { count: minutes })}</span>
                  </>
                )}
              </p>
              <h1
                className={`${grid.readerTitle} article-title`}
                id="article-title"
                {...pe('title')}
              >
                {title}
              </h1>
            </header>

            {cover?.url && (
              <div className={`${grid.readerImage} article-cover`} {...pe('cover_image')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={cover.alt}
                  className={`${grid.image} article-cover-image`}
                  src={cover.url}
                />
              </div>
            )}

            {/* Narrow screens: the same card in the column, its contents folded. */}
            <div className="xl:hidden">{sideCard(true)}</div>

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
                <div {...pe('body')}>
                  <RichTextField
                    user={user}
                    blocks={{
                      cardStack: (fields: { id?: string }) => {
                        const stack = fields.id ? stacks[fields.id] : undefined
                        if (!stack) return null
                        return stack.layout === 'grid' ? (
                          <ArticleCardGrid
                            categories={stack.categories}
                            label={stack.label}
                            posts={stack.posts}
                            seasons={stack.seasons}
                          />
                        ) : (
                          <ArticleCardStack
                            dir={isRtl(locale) ? 'rtl' : 'ltr'}
                            items={stack.items}
                            label={stack.label}
                            locale={locale}
                          />
                        )
                      },
                    }}
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
                          user={user}
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
                    <RichTextField
                      user={user}
                      className="article-prose article-prose--notes"
                      data={notes}
                    />
                  </ArticleNotes>
                </div>
              )}
            </div>

            {/* Tools at the end of the text; on wide screens they are in the side card. */}
            <section
              aria-labelledby="article-share"
              className="mt-2 grid gap-3 border-t border-border pt-6 xl:hidden"
            >
              <h2 className="font-sans text-sm text-[var(--text-muted)]" id="article-share">
                {tShare('heading')}
              </h2>
              <ShareBar
                email={email}
                file={printEdition}
                label={tShare('article')}
                path={articlePath}
                title={title}
              />
            </section>

            {/* Taking it with AI, its own section at the tools' spacing. */}
            <section
              aria-labelledby="article-ai"
              className="mt-6 grid gap-3 border-t border-border pt-6 xl:hidden"
            >
              <h2 className="font-sans text-sm text-[var(--text-muted)]" id="article-ai">
                {tShare('aiHeading')}
              </h2>
              <StudyWithAI kind="article" path={articlePath} />
              <ol className="grid gap-1 list-decimal list-inside text-xs leading-relaxed text-[var(--text-muted)]">
                {aiSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
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

            {/* Not in the admin's preview frame; an editor's own tab shows it, as visitors see it. */}
            <OutsideAdminFrame>
              <NewsletterSignupEnd locale={locale} />
            </OutsideAdminFrame>
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
