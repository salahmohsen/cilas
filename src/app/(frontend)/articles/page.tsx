import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { getPublishedArticles } from '@/api/articles.api'
import {
  authorNames,
  excerptOf,
  indexLabel,
  joinNames,
  publicationOf,
  readingMinutes,
  yearOf,
} from '@/lib/articles'
import { readingFonts } from '@/lib/fonts'
import type { Article, Media, Publication } from '@/payload-types'

export const metadata: Metadata = {
  title: 'Articles — CILAS',
  description: 'Essays, translations and writing from the Cairo Institute of Liberal Arts and Sciences.',
}

export const revalidate = 3600

type Props = { searchParams: Promise<{ publication?: string }> }

const cover = (a: Article): Media | undefined =>
  typeof a.cover_image === 'object' && a.cover_image ? a.cover_image : undefined

export default async function ArticlesPage({ searchParams }: Props) {
  const { publication: selected } = await searchParams
  const payload = await getPayload({ config })
  const { docs: all } = await getPublishedArticles(payload)

  // The publications that hold at least one listed article, in first-seen order.
  const publications = [
    ...new Map(
      all.flatMap((a) => {
        const p = publicationOf(a)
        return p ? [[p.slug, p] as const] : []
      }),
    ).values(),
  ]
  const articles = selected
    ? all.filter((a) =>
        selected === 'other' ? !publicationOf(a) : publicationOf(a)?.slug === selected,
      )
    : all
  const featured = articles.find((a) => a.featured) ?? articles[0]
  const rest = articles.filter((a) => a !== featured)

  return (
    <div className={`${readingFonts} px-4 pb-24 sm:px-6`}>
      {/* Masthead: one big word, a count, a hairline. */}
      <header className="border-b border-foreground pt-16 pb-6 sm:pt-24">
        <p className="font-mono text-[0.7rem] tracking-[0.2em] uppercase opacity-60">
          Cairo Institute of Liberal Arts and Sciences
        </p>
        <h1 className="mt-4 flex items-start gap-3 text-[clamp(3.5rem,13vw,10rem)] leading-[0.82] font-semibold tracking-[-0.045em]">
          Articles
          <sup className="mt-[0.4em] font-mono text-[clamp(0.9rem,1.6vw,1.25rem)] font-normal tracking-normal opacity-60">
            {all.length}
          </sup>
        </h1>
        <p className="mt-8 max-w-xl font-serif-reading text-xl leading-snug opacity-80">
          Essays, translations and notes written with and around CILAS — from the
          rooftop in Darb el-Labbana to the Translation Lab.
        </p>
      </header>

      {/* Sections: one per publication, plus everything else. */}
      <nav
        aria-label="Filter by publication"
        className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border py-3 font-mono text-[0.72rem] tracking-[0.12em] uppercase"
      >
        <FilterLink active={!selected} href="/articles">
          All
        </FilterLink>
        {publications.map((p: Publication) => (
          <FilterLink
            active={selected === p.slug}
            href={`/articles?publication=${p.slug}`}
            key={p.slug}
          >
            {p.title}
          </FilterLink>
        ))}
        {all.some((a) => !publicationOf(a)) && (
          <FilterLink active={selected === 'other'} href="/articles?publication=other">
            Notes &amp; blog
          </FilterLink>
        )}
      </nav>

      {articles.length === 0 && (
        <p className="py-24 text-center font-serif-reading text-2xl opacity-60">
          Nothing published here yet.
        </p>
      )}

      {featured && <Featured article={featured} />}

      {rest.length > 0 && (
        <section aria-label="All articles" className="mt-16">
          <div className="hidden grid-cols-[3.5rem_minmax(0,1fr)_13rem_11rem_4rem] gap-6 border-b border-foreground pb-2 font-mono text-[0.68rem] tracking-[0.14em] uppercase opacity-60 md:grid">
            <span>No.</span>
            <span>Title</span>
            <span>Author</span>
            <span>Publication</span>
            <span className="text-end">Year</span>
          </div>
          <ol>
            {rest.map((a, i) => (
              <IndexRow article={a} index={i + 1} key={a.id} />
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function FilterLink({
  active,
  href,
  children,
}: {
  active: boolean
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'bg-foreground px-1.5 text-background'
          : 'px-1.5 opacity-60 transition-opacity hover:opacity-100'
      }
      href={href}
    >
      {children}
    </Link>
  )
}

/** The lead story: image (or a flat colour block) beside a large title. */
function Featured({ article }: { article: Article }) {
  const image = cover(article)
  const pub = publicationOf(article)
  return (
    <Link
      className="group mt-10 grid gap-6 border-b border-border pb-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10"
      href={`/articles/${article.slug}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[oklch(0.93_0.17_110)]">
        {image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={image.alt}
            className="h-full w-full object-cover grayscale transition duration-500 group-hover:grayscale-0"
            src={image.url}
          />
        ) : (
          <span className="absolute inset-0 flex items-end p-6 text-[clamp(2rem,5vw,4rem)] leading-[0.9] font-semibold tracking-tight">
            {pub?.title ?? 'CILAS'}
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <p className="font-mono text-[0.7rem] tracking-[0.16em] uppercase opacity-60">
          {indexLabel(0)} — {pub?.title ?? 'Notes'} · {yearOf(article)}
        </p>
        <h2 className="mt-4 font-serif-reading text-[clamp(2rem,4vw,3.25rem)] leading-[1.02] tracking-tight group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
          {article.title}
        </h2>
        <p className="mt-3 text-sm">{joinNames(authorNames(article))}</p>
        <p className="mt-6 font-serif-reading text-lg leading-relaxed opacity-75">{excerptOf(article)}</p>
        <p className="mt-auto pt-6 font-mono text-[0.7rem] tracking-[0.16em] uppercase">
          Read · {readingMinutes(article)} min →
        </p>
      </div>
    </Link>
  )
}

/** A ruled index row that inverts on hover. */
function IndexRow({ article, index }: { article: Article; index: number }) {
  const pub = publicationOf(article)
  const image = cover(article)
  return (
    <li className="border-b border-border">
      <Link
        className="group grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 px-1 py-4 transition-colors hover:bg-foreground hover:text-background md:grid-cols-[3.5rem_minmax(0,1fr)_13rem_11rem_4rem] md:items-baseline md:gap-6"
        href={`/articles/${article.slug}`}
      >
        <span className="font-mono text-sm opacity-60">{indexLabel(index)}</span>
        <span className="flex items-center gap-4">
          <span className="font-serif-reading text-[1.4rem] leading-tight md:text-[1.6rem]">
            {article.title}
          </span>
          {image?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="ms-auto hidden h-12 w-16 shrink-0 object-cover grayscale group-hover:grayscale-0 lg:block"
              src={image.url}
            />
          )}
        </span>
        <span className="col-start-2 text-sm opacity-80 md:col-start-auto">
          {joinNames(authorNames(article))}
        </span>
        <span className="col-start-2 font-mono text-[0.7rem] tracking-[0.1em] uppercase opacity-60 md:col-start-auto">
          {pub?.title ?? 'Notes'}
        </span>
        <span className="col-start-2 font-mono text-sm opacity-60 md:col-start-auto md:text-end">
          {yearOf(article)}
        </span>
      </Link>
    </li>
  )
}
