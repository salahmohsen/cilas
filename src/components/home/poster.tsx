'use client'

import { ArrowRight } from 'lucide-react'

import { DeadlineCountdown } from '@/components/home/deadline-countdown'

/**
 * The four poster layouts, after the festival posters on the moodboard:
 *
 *   0 yellow  the image, then a colour panel with the label on top and the title at the foot; footer strip
 *   1 blue    a colour panel with the title on top and the credit at the foot, then the image; footer strip
 *   2 pink    the strip on top; a colour panel with the title and credit, then the image
 *   3 green   a colour bar with the title and the credit, the image across, then the strip
 *
 * "Then" follows the reading direction, so Arabic mirrors each layout. On a
 * narrow screen every layout stacks: image, panel, strip.
 */
export type PosterLayout = 0 | 1 | 2 | 3

export type PosterData = {
  id: string
  href: string
  layout: PosterLayout
  /** Above the title: what it is ("Thematic Course", the publication). */
  label?: string
  title: string
  /** A few lines under the title: what it is about. */
  description?: string
  /** Under the title: who ("With Ghosoun Ismail", the author). */
  credit?: string
  image?: { src: string; alt: string }
  /** The strip's coloured cell: a line or two, then the time left to a deadline (YYYY-MM-DD). */
  meta: { lines: string[]; deadline?: string }
  /** The strip's white cell: when and where, the reading time. */
  details: string[]
  /** What the link does: "Apply", "Read". */
  action: string
}

const FALLBACK = '/assets/images/cilas-classroom.jpg'

export function Poster({ poster }: { poster: PosterData }) {
  const { layout, label, title, description, credit, image, meta, details, action, href } = poster
  const picture = (
    <div className="poster-image">
      {/* Covers come from the storage host, as on course pages. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={image?.alt ?? ''} draggable={false} src={image?.src ?? FALLBACK} />
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
        {meta.deadline ? <DeadlineCountdown deadline={meta.deadline} /> : null}
      </span>
      <span className="poster-details">
        {details.map((d) => (
          <span dir="auto" key={d}>
            {d}
          </span>
        ))}
        <span className="poster-action" aria-hidden>
          {action}
          <ArrowRight className="poster-arrow" size={16} strokeWidth={2} />
        </span>
      </span>
    </div>
  )
  // The title and its description stay together, one group.
  const heading = (
    <div className="poster-heading">
      <h3 className="poster-title" dir="auto">
        {/* The whole poster is the link's target; the title names it. */}
        <a className="poster-link" href={href}>
          {title}
        </a>
      </h3>
      {description ? (
        <p className="poster-description" dir="auto">
          {description}
        </p>
      ) : null}
    </div>
  )

  return (
    <article className="poster" data-layout={layout}>
      {layout === 3 ? (
        <>
          <div className="poster-panel">
            {heading}
            {credit ? (
              <p className="poster-credit" dir="auto">
                {credit}
              </p>
            ) : null}
          </div>
          {picture}
          {strip}
        </>
      ) : (
        <>
          {layout === 2 ? strip : null}
          <div className="poster-body">
            {layout === 0 ? picture : null}
            <div className="poster-panel">
              {layout === 0 ? (
                <p className="poster-label" dir="auto">
                  {label}
                </p>
              ) : (
                heading
              )}
              {layout === 0 ? (
                heading
              ) : credit || label ? (
                <p className="poster-credit" dir="auto">
                  {credit ?? label}
                </p>
              ) : null}
            </div>
            {layout === 0 ? null : picture}
          </div>
          {layout === 2 ? null : strip}
        </>
      )}
    </article>
  )
}
