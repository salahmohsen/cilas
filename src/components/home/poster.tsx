'use client'

import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useState, type CSSProperties, type ReactNode } from 'react'

import { InViewTitle } from '@/components/arc/in-view-title/in-view-title'
import { CilasLogo } from '@/components/cilas-logo'
import { DeadlineCountdown } from '@/components/home/deadline-countdown'
import { focalPointStyle, type MediaImage } from '@/lib/media-image'
import { POSTER_COLORS } from '@/lib/poster-colors'

/**
 * The four poster variants, after the festival posters on the moodboard:
 *
 *   0 yellow  the image, then a colour panel with the label on top and the title and credit at the foot; footer strip
 *   1 blue    a colour panel with the title on top and the credit at the foot, then the image; footer strip
 *   2 pink    the strip on top; a colour panel with the title and credit, then the image
 *   3 green   the same layout as blue
 *
 * "Then" follows the reading direction, so Arabic mirrors each layout. On a
 * narrow screen every layout stacks: image, panel, strip.
 */
export type PosterLayout = 0 | 1 | 2 | 3

export type PosterData = {
  id: string
  href: string
  layout: PosterLayout
  color?: string
  /** Above the title: what it is ("Thematic Course", the publication). */
  label?: string
  /** Keep the label in its own top cell across every layout. */
  separateLabel?: boolean
  title: string
  /** Under the title: who ("With Ghosoun Ismail", the author). */
  credit?: string
  /** What kind of thing it is, with its icon: its own box at the start of the credit row. */
  tag?: { icon: ReactNode; text: string }
  image?: MediaImage
  /** Prepared images can be served directly without another server-side transform. */
  imageDelivery?: 'direct'
  /** The strip's coloured cell: a line or two; the time left to a deadline (YYYY-MM-DD) gets the cell after it. */
  meta: { lines: string[]; deadline?: string; status?: string }
  /** The strip's white cell: when and where, the reading time. */
  details: (string | { text: string; href: string })[]
  /** What the link does: "Apply", "Read". */
  action: string
}

export function Poster({
  poster,
  imageLoading = 'lazy',
  imageFetchPriority,
}: {
  poster: PosterData
  imageLoading?: 'eager' | 'lazy'
  imageFetchPriority?: 'high' | 'auto'
}) {
  const {
    layout: variant,
    color,
    label,
    separateLabel,
    title,
    credit,
    tag,
    image,
    imageDelivery,
    meta,
    details,
    action,
    href,
  } = poster
  // No image, or one that fails to load: the CILAS mark on the paper.
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const missing = !image || failedSource === image.src
  const layout = variant === 3 ? 1 : variant
  const labelOnTop = layout === 0 || separateLabel
  const picture = (
    <div className="poster-image" data-fallback={missing ? 'logo' : undefined}>
      {missing ? (
        <CilasLogo className="poster-fallback-logo" />
      ) : (
        <Image
          alt={image.alt}
          draggable={false}
          fill
          loading={imageLoading}
          fetchPriority={imageFetchPriority}
          sizes="(min-width: 90rem) 53rem, (min-width: 48rem) 62vw, 100vw"
          src={image.src}
          unoptimized={imageDelivery === 'direct'}
          onError={() => setFailedSource(image.src)}
          style={focalPointStyle(image)}
        />
      )}
    </div>
  )
  const strip = (
    <div className="poster-strip">
      <span className="poster-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" draggable={false} src="/assets/images/logo.webp" />
      </span>
      <span className="poster-meta">
        {meta.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
      {/* The time left: its own cell, the strip's full height, on every screen. */}
      {meta.deadline ? (
        <span className="poster-time">
          <DeadlineCountdown deadline={meta.deadline} />
        </span>
      ) : null}
      {meta.status ? <span className="poster-time poster-status">{meta.status}</span> : null}
      <div className="poster-footer">
        {details.length > 0 ? (
          <span className="poster-details">
            {details.map((d) =>
              typeof d === 'string' ? (
                <span dir="auto" key={d}>
                  {d}
                </span>
              ) : (
                <a
                  className="poster-detail-link"
                  dir="auto"
                  href={d.href}
                  key={d.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {d.text}
                </a>
              ),
            )}
          </span>
        ) : null}
        <span className="poster-action-cell">
          <span className="poster-action" aria-hidden>
            {action}
            <ArrowRight className="poster-arrow" size={16} strokeWidth={2} />
          </span>
        </span>
      </div>
    </div>
  )
  const heading = (
    <div className="poster-heading">
      <div className="poster-title" dir="auto">
        {/* The whole poster is the link's target; the title names it. */}
        <a className="poster-link" href={href} aria-label={title}>
          <InViewTitle
            as="h3"
            className="poster-title-reveal"
            text={title}
            variant="line"
            once={false}
          />
        </a>
      </div>
      {labelOnTop && credit ? (
        <p className="poster-credit" dir="auto">
          {credit}
        </p>
      ) : null}
    </div>
  )

  return (
    <article
      className="poster"
      data-layout={layout}
      data-color={variant}
      data-separate-label={separateLabel || undefined}
      style={{ '--poster-color': color ?? POSTER_COLORS[variant] } as CSSProperties}
    >
      {layout === 2 ? strip : null}
      <div className="poster-body">
        {layout === 0 ? picture : null}
        <div className="poster-panel">
          {labelOnTop ? (
            <p className="poster-label" dir="auto">
              {label}
            </p>
          ) : (
            heading
          )}
          {labelOnTop ? (
            heading
          ) : tag ? (
            <div className="poster-credit poster-credit-row">
              <span className="poster-tag">
                {tag.icon}
                <span dir="auto">{tag.text}</span>
              </span>
              {credit ? (
                <span className="poster-credit-text" dir="auto">
                  {credit}
                </span>
              ) : null}
            </div>
          ) : credit || label ? (
            <p className="poster-credit" dir="auto">
              {credit ?? label}
            </p>
          ) : null}
        </div>
        {layout === 0 ? null : picture}
      </div>
      {layout === 2 ? null : strip}
    </article>
  )
}
