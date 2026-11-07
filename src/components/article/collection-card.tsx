import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import type { CSSProperties, ReactNode } from 'react'

import { Link } from '@/i18n/navigation'
import { localDigits } from '@/lib/digits'
import type { MediaImage } from '@/lib/media-image'
import { POSTER_COLORS } from '@/components/arc/lib/poster-colors'

export type CollectionCardItem = { id: number; title: string; authors: string; href: string }

/**
 * A collection's articles in their order, the open one marked, opened from
 * the article's side card (CollectionDialog). A poster card
 * (docs/content-driven-card-layouts.md, section 7): the cover beside the
 * collection's name on the card's colour, the articles as ruled rows, and a
 * strip with the count and a link to the whole collection. Content sizes the
 * card: the head takes its height from the name, and the cover fits whole
 * inside that height.
 */
export function CollectionCard({
  title,
  href,
  cover,
  items,
  current,
  labels,
  locale,
  close,
  color = POSTER_COLORS[0],
}: {
  title: string
  href: string
  cover?: MediaImage
  items: CollectionCardItem[]
  current: number
  labels: { kicker: string; current: string; count: string; all: string }
  locale: string
  /** A box at the strip's end that closes the dialog the card sits in. */
  close?: ReactNode
  color?: string
}) {
  return (
    <div className="collection-card-frame">
      <nav
        aria-labelledby="collection-title"
        className="collection-card"
        style={{ '--poster-color': color } as CSSProperties}
      >
        <header className="collection-card-head" data-cover={cover ? '' : undefined}>
          {cover && (
            <div className="collection-card-cover">
              <div className="collection-card-cover-frame">
                <Image alt={cover.alt} fill sizes="10rem" src={cover.src} />
              </div>
            </div>
          )}
          <div className="collection-card-panel">
            <p className="collection-card-label">{labels.kicker}</p>
            <h2 className="collection-card-title" dir="auto" id="collection-title">
              <Link href={href}>{title}</Link>
            </h2>
          </div>
        </header>

        <CollectionRows
          current={current}
          currentLabel={labels.current}
          items={items}
          locale={locale}
        />

        <div className="collection-card-strip">
          <span className="collection-card-count">{labels.count}</span>
          <Link className="collection-card-action" href={href}>
            <span>{labels.all}</span>
            <ArrowRight aria-hidden size={16} />
          </Link>
          {close}
        </div>
      </nav>
    </div>
  )
}

/**
 * A collection's articles as ruled rows: a number box, then the title and
 * its authors. The open article, when listed, sits on the card's colour,
 * marked as the reader's place. Shared by the collection card and, on
 * phones, the Card stack block.
 */
export function CollectionRows({
  items,
  current,
  currentLabel,
  locale,
}: {
  items: CollectionCardItem[]
  current?: number
  currentLabel?: string
  locale: string
}) {
  return (
    <ol className="collection-card-list">
      {items.map((item, i) => {
        const here = item.id === current
        const body = (
          <>
            <span aria-hidden className="collection-card-number">
              {localDigits(String(i + 1).padStart(2, '0'), locale)}
            </span>
            <span className="collection-card-text">
              <span className="collection-card-item-title" dir="auto">
                {item.title}
              </span>
              {item.authors && (
                <span className="collection-card-authors" dir="auto">
                  {item.authors}
                </span>
              )}
              {here && currentLabel && <span className="collection-card-here">{currentLabel}</span>}
            </span>
          </>
        )
        return (
          <li key={item.id}>
            {here ? (
              <span aria-current="page" className="collection-card-item" data-current>
                {body}
              </span>
            ) : (
              <Link className="collection-card-item" href={item.href}>
                {body}
              </Link>
            )}
          </li>
        )
      })}
    </ol>
  )
}
