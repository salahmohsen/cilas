import config from '@payload-config'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { getArticle, hasLocaleBody, type Locale } from '@/api/articles.api'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { RichTextField } from '@/components/RichTextField'
import {
  authorNames,
  creditNames,
  excerptOf,
  indexLabel,
  joinNames,
  publicationOf,
  readingMinutes,
  yearOf,
} from '@/lib/articles'
import { readingFonts } from '@/lib/fonts'
import type { Article, Person } from '@/payload-types'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string }>
}

export const revalidate = 3600

const localeOf = (lang?: string): Locale => (lang === 'ar' ? 'ar' : 'en')

// Interface labels in each reading language.
const LABELS = {
  en: {
    articles: 'Articles',
    by: 'By',
    and: 'and',
    translatedBy: 'Translated by',
    publication: 'Publication',
    published: 'Published',
    reading: 'Reading time',
    min: 'min',
    language: 'Language',
    original: 'Original',
    credits: 'Credits',
    more: 'More from',
    back: 'All articles',
    untranslated: 'This article has no Arabic text yet.',
  },
  ar: {
    articles: 'مقالات',
    by: 'بقلم',
    and: 'و',
    translatedBy: 'ترجمة',
    publication: 'المنشور',
    published: 'تاريخ النشر',
    reading: 'مدة القراءة',
    min: 'دقيقة',
    language: 'اللغة',
    original: 'الأصل',
    credits: 'المساهمون',
    more: 'المزيد من',
    back: 'كل المقالات',
    untranslated: 'لا يوجد نص عربي لهذا المقال بعد.',
  },
} as const

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  editor: { en: 'Editor', ar: 'تحرير' },
  translator: { en: 'Translation', ar: 'ترجمة' },
  copy_editor: { en: 'Copy-editing', ar: 'تدقيق' },
  proofreader: { en: 'Proofreading', ar: 'مراجعة لغوية' },
  supervisor: { en: 'Supervision', ar: 'إشراف' },
  coordinator: { en: 'Coordination', ar: 'تنسيق' },
  art_director: { en: 'Art direction', ar: 'الإخراج الفني' },
  cover_designer: { en: 'Cover design', ar: 'تصميم الغلاف' },
  illustrator: { en: 'Illustration', ar: 'رسوم' },
  photographer: { en: 'Photography', ar: 'تصوير' },
}

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
  return docs.map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, { lang }] = await Promise.all([params, searchParams])
  const payload = await getPayload({ config })
  const article = await getArticle(payload, slug, { locale: localeOf(lang) })
  if (!article) return {}
  const title = article.meta?.title || `${article.title} — CILAS`
  const description = article.meta?.description || excerptOf(article, 160)
  return { title, description, openGraph: { title, description, type: 'article' } }
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const [{ slug }, { lang }] = await Promise.all([params, searchParams])
  const locale = localeOf(lang)
  const { isEnabled: preview } = await draftMode()
  const payload = await getPayload({ config })

  const article = await getArticle(payload, slug, { locale, preview })
  if (!article) notFound()

  const [hasEn, hasAr] = await Promise.all([
    hasLocaleBody(payload, article.id, 'en'),
    hasLocaleBody(payload, article.id, 'ar'),
  ])
  const t = LABELS[locale]
  const rtl = locale === 'ar'
  const pub = publicationOf(article)
  const translators = creditNames(article, 'translator')
  const minutes = readingMinutes(article)
  // The publication's other articles, in its own order, that a visitor may read.
  const siblingIds = (pub?.articles ?? [])
    .map((a) => (typeof a === 'object' && a !== null ? a.id : a))
    .filter((id) => id !== article.id)
  const { docs: readable } = siblingIds.length
    ? await payload.find({
        collection: 'articles',
        where: { and: [{ id: { in: siblingIds } }, { _status: { equals: 'published' } }] },
        depth: 1,
        limit: siblingIds.length,
        locale,
        fallbackLocale: 'en',
        overrideAccess: false,
      })
    : { docs: [] as Article[] }
  const siblings = siblingIds
    .map((id) => readable.find((a) => a.id === id))
    .filter((a): a is Article => Boolean(a))
  const original = article.translation
  const originalAuthors = (original?.original_authors ?? [])
    .filter((p): p is Person => typeof p === 'object' && p !== null)
    .map((p) => p.name)
  const otherCredits = (article.credits ?? []).filter((c) => c.role !== 'translator' && c.role !== 'author')
  const hasOriginal = Boolean(original && (original.original_title || original.original_source))
  const hasMargin = hasOriginal || otherCredits.length > 0

  return (
    <article
      className={`${readingFonts} px-4 pb-24 sm:px-6`}
      dir={rtl ? 'rtl' : 'ltr'}
      lang={locale}
    >
      {preview && <RefreshRouteOnSave />}
      {/* Running head: where this sits, and the language switch. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground py-3 font-mono text-[0.7rem] tracking-[0.14em] uppercase">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2">
          <Link className="opacity-60 hover:opacity-100" href="/articles">
            {t.articles}
          </Link>
          {pub && (
            <>
              <span className="opacity-40">/</span>
              <Link className="opacity-60 hover:opacity-100" href={`/articles?publication=${pub.slug}`}>
                {pub.title}
              </Link>
            </>
          )}
        </nav>
        {hasEn && hasAr && (
          <div aria-label={t.language} className="flex gap-1" role="group">
            <LangLink active={locale === 'en'} href={`/articles/${slug}`} lang="en">
              EN
            </LangLink>
            <LangLink active={locale === 'ar'} href={`/articles/${slug}?lang=ar`} lang="ar">
              عربي
            </LangLink>
          </div>
        )}
      </div>

      {/* Title block. */}
      <header className="pt-14 pb-10 sm:pt-20">
        <h1
          className={`max-w-[18ch] font-serif-reading text-[clamp(2.5rem,7vw,5.75rem)] leading-[0.98] tracking-[-0.02em] ${rtl ? 'leading-[1.25]' : ''}`}
        >
          {article.title}
        </h1>
        <p className="mt-8 text-lg">
          <span className="opacity-60">{t.by} </span>
          {joinNames(authorNames(article), t.and)}
        </p>
        {translators.length > 0 && (
          <p className="mt-1 text-sm opacity-70">
            {t.translatedBy} {joinNames(translators, t.and)}
          </p>
        )}
      </header>

      {/* Facts strip, ruled like a table. */}
      <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        <Fact label={t.publication}>{pub?.title ?? '—'}</Fact>
        <Fact label={t.published}>{yearOf(article)}</Fact>
        <Fact label={t.reading}>{minutes ? `${minutes} ${t.min}` : '—'}</Fact>
        <Fact label={t.language}>{rtl ? 'العربية' : 'English'}</Fact>
      </dl>

      {typeof article.cover_image === 'object' && article.cover_image?.url && (
        <figure className="mt-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={article.cover_image.alt} className="w-full object-cover" src={article.cover_image.url} />
        </figure>
      )}

      <div
        className={`mt-12 grid gap-10 lg:gap-16 ${hasMargin ? 'lg:grid-cols-[14rem_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)] lg:ps-[calc(14rem+4rem)]'}`}
      >
        {/* Margin: provenance and credits, sticky beside the text. */}
        <aside className={`order-2 text-sm lg:order-1 ${hasMargin ? '' : 'hidden'}`}>
          <div className="space-y-8 lg:sticky lg:top-24">
            {original && hasOriginal && (
              <section>
                <h2 className="font-mono text-[0.68rem] tracking-[0.14em] uppercase opacity-60">
                  {t.original}
                </h2>
                <p className="mt-2 font-serif-reading text-base leading-snug" dir="auto">
                  {original.original_title}
                </p>
                {originalAuthors.length > 0 && (
                  <p className="mt-1 opacity-70" dir="auto">
                    {joinNames(originalAuthors, t.and)}
                  </p>
                )}
                {original.original_source && (
                  <p className="mt-1 opacity-60" dir="auto">
                    {original.original_source}
                  </p>
                )}
              </section>
            )}
            {otherCredits.length > 0 && (
              <section>
                <h2 className="font-mono text-[0.68rem] tracking-[0.14em] uppercase opacity-60">
                  {t.credits}
                </h2>
                <dl className="mt-2 space-y-2">
                  {otherCredits.map((c) => (
                    <div key={c.id ?? c.role}>
                      <dt className="opacity-60">{c.label || ROLE_LABELS[c.role]?.[locale] || c.role}</dt>
                      <dd>
                        {joinNames(
                          c.people.filter((p): p is Person => typeof p === 'object' && p !== null).map((p) => p.name),
                          t.and,
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </aside>

        {/* The text. */}
        <div className="order-1 lg:order-2">
          {article.body?.root?.children?.length ? (
            <RichTextField className="article-prose" data={article.body} />
          ) : (
            <p className="font-serif-reading text-xl opacity-60">{t.untranslated}</p>
          )}
        </div>
      </div>

      {/* More from the same publication, as a numbered index. */}
      {pub && siblings.length > 0 && (
        <section className="mt-24">
          <h2 className="border-b border-foreground pb-3 font-mono text-[0.7rem] tracking-[0.14em] uppercase">
            {t.more} {pub.title}
          </h2>
          <ol>
            {siblings.map((s, i) => (
              <li className="border-b border-border" key={s.id}>
                <Link
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 px-1 py-4 transition-colors hover:bg-foreground hover:text-background sm:grid-cols-[3.5rem_minmax(0,1fr)_14rem]"
                  href={`/articles/${s.slug}${rtl ? '?lang=ar' : ''}`}
                >
                  <span className="font-mono text-sm opacity-60">{indexLabel(i)}</span>
                  <span className="font-serif-reading text-xl leading-tight">{s.title}</span>
                  <span className="col-start-2 text-sm opacity-70 sm:col-start-auto">
                    {joinNames(authorNames(s), t.and)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="mt-16 font-mono text-[0.7rem] tracking-[0.14em] uppercase">
        <Link className="opacity-60 hover:opacity-100" href="/articles">
          {rtl ? '→' : '←'} {t.back}
        </Link>
      </p>
    </article>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border px-1 py-3 not-last:border-e max-sm:nth-2:border-e-0 max-sm:nth-[-n+2]:border-b">
      <dt className="font-mono text-[0.65rem] tracking-[0.14em] uppercase opacity-60">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}

function LangLink({
  active,
  href,
  lang,
  children,
}: {
  active: boolean
  href: string
  lang: string
  children: React.ReactNode
}) {
  return (
    <Link
      aria-current={active ? 'true' : undefined}
      className={active ? 'bg-foreground px-2 py-0.5 text-background' : 'px-2 py-0.5 opacity-60 hover:opacity-100'}
      href={href}
      hrefLang={lang}
    >
      {children}
    </Link>
  )
}
