import type { DateTimeFormatOptions } from 'next-intl'
import { getFormatter, getNow, getTranslations } from 'next-intl/server'
import { CalendarDays, Megaphone, MessageSquare, UsersRound, Vote } from 'lucide-react'

import { Badge } from '@/components/arc/badge/badge'
import type { FeedRow as FeedRowData } from '@/lib/spaces-data'
import { CAIRO } from '@/lib/cairo-day'
import { outsideLinks, previewsWithin, type LinkPreview } from '@/lib/link-preview'
import { eventParts, eventSplit, plainLine } from '@/lib/space-event'

import type { FeedContext } from './feed-row'
import { LinkImage } from './link-image'
import { PostDateLink, PostDialog } from './post-dialog-link'
import { PinnedScroller } from './pinned-scroller'
import styles from './space.module.css'

const WEEK = 7 * 86_400_000

/** At most this many cards; older pinned posts fall into the feed by their activity. */
export const PINNED_CARDS = 6

/**
 * The pinned posts a member has not seen come first (newer than the last
 * visit, and not their own), then announcements, then the newest.
 */
export const pinnedOrder = (rows: FeedRowData[], lastVisit: string | null, me: number | null) => {
  const fresh = (r: FeedRowData) => isFresh(r, lastVisit, me)
  return [...rows].sort(
    (a, b) =>
      Number(fresh(b)) - Number(fresh(a)) ||
      Number(b.post.kind === 'announcement') - Number(a.post.kind === 'announcement') ||
      b.post.createdAt.localeCompare(a.post.createdAt),
  )
}

const isFresh = (row: FeedRowData, lastVisit: string | null, me: number | null) =>
  lastVisit != null && row.authorId !== me && row.post.createdAt > lastVisit

const BARE_URL = /https?:\/\/\S+/g

/**
 * What a card shows of a post: a title line, the text after it, and its first
 * photo. A bare address reads as its page's title and summary when the page
 * has a preview, and the page's image fills the box of a post with no photo.
 */
const cardParts = (row: FeedRowData, link: LinkPreview | null) => {
  const { post } = row
  const { title, rest } =
    post.kind === 'event'
      ? (({ title, description }) => ({ title, rest: description }))(eventParts(post))
      : eventSplit(post.body ?? '')
  const text = rest.split('\n').map(plainLine).filter(Boolean).join(' ')
  const photo = row.files.find((f) => f.isImage)?.url
  const cover =
    post.kind === 'event' && typeof post.event_cover === 'object'
      ? (post.event_cover?.url ?? undefined)
      : undefined
  const named = title.replace(BARE_URL, '').trim()
  const said = text.replace(BARE_URL, '').trim()
  const own = photo ?? cover
  return {
    title: named || link?.title || said || title,
    text: named || link ? said || link?.description || '' : '',
    image: own ?? null,
    linkImage: own ? null : (link?.image ?? null),
  }
}

/** Each kind's label and icon, as the composer names them. */
const KIND = {
  announcement: { label: 'kind_announcement', icon: Megaphone },
  event: { label: 'kind_event', icon: CalendarDays },
  vote: { label: 'kind_vote', icon: Vote },
  discussion: { label: 'kind_discussion', icon: MessageSquare },
} as const

/** A vote's first options as shares of every choice, for the card's preview. */
const VOTE_ROWS = 3

/**
 * The pinned posts as a row of cards of one size, so each visit leads with
 * what is new rather than the same long posts (spec §7). Every card has the
 * same frame: the kind and "New" on top, the title and text, then who and
 * when at the foot with one count. What sits above the text follows the
 * kind: a photo, an event's calendar leaf, or a vote's leading options; a
 * post with none of these gives the space to its text. A card opens its post
 * in the dialog, like the date of a post in the feed.
 */
export async function PinnedCards({
  rows,
  context,
  path,
  lastVisit,
  seeAll,
}: {
  rows: FeedRowData[]
  context: FeedContext
  path: string
  lastVisit: string | null
  /** Where every announcement is listed, when some did not fit in the row */
  seeAll: string | null
}) {
  const [t, tp, format, now] = await Promise.all([
    getTranslations('Spaces'),
    getTranslations('SpacePost'),
    getFormatter(),
    getNow(),
  ])
  const me = context.viewer.personId
  // An event or a vote has its own box; another post's first link may give it one.
  const linked = rows.map((r) =>
    r.post.kind === 'event' || r.post.kind === 'vote'
      ? null
      : (outsideLinks(r.post.body ?? '', 1)[0] ?? null),
  )
  const found = await previewsWithin(linked.filter((u): u is string => u !== null))
  const previews = new Map(
    linked.filter((u): u is string => u !== null).map((u, i) => [u, found[i] ?? null]),
  )
  return (
    <section className={styles.pinnedSection} aria-labelledby="pinned-title">
      <PinnedScroller
        label={t('pinnedTitle')}
        previous={t('pinnedPrevious')}
        next={t('pinnedNext')}
        head={
          <>
            <h2 id="pinned-title" className={styles.sectionTitle}>
              {t('pinnedTitle')}
            </h2>
            {seeAll && (
              <a href={seeAll} className={styles.pinnedSeeAll}>
                {t('pinnedSeeAll')}
              </a>
            )}
          </>
        }
      >
        {rows.map((row, i) => {
          const { post } = row
          const href = `${path}/posts/${post.id}`
          const link = previews.get(linked[i] ?? '') ?? null
          const { title, text, image, linkImage } = cardParts(row, link)
          const kind = KIND[post.kind as keyof typeof KIND] ?? KIND.discussion
          const author =
            row.authorName ??
            (row.authorId != null ? context.people.get(row.authorId)?.name : undefined) ??
            tp('bySystem')
          const date = new Date(post.createdAt)
          const when =
            now.getTime() - date.getTime() < WEEK
              ? format.relativeTime(date, now)
              : format.dateTime(date, { dateStyle: 'medium' })
          const startsAt = post.kind === 'event' ? post.event_starts_at : null
          const vote = post.kind === 'vote' && row.vote && !image ? row.vote : null
          const chosen = vote ? vote.options.reduce((sum, o) => sum + o.count, 0) : 0
          const count =
            post.kind === 'event' && row.rsvp
              ? {
                  icon: UsersRound,
                  n: row.rsvp.counts.going,
                  label: tp('rsvpGoingCount', { count: row.rsvp.counts.going }),
                }
              : vote
                ? {
                    icon: Vote,
                    n: vote.voters,
                    label: tp('voteVoters', { count: vote.voters }),
                  }
                : {
                    icon: MessageSquare,
                    n: row.commentCount,
                    label: tp('comments', { count: row.commentCount }),
                  }
          const media = image || linkImage ? 'photo' : startsAt ? 'leaf' : vote ? 'vote' : 'none'
          const leaf = (options: DateTimeFormatOptions) =>
            format.dateTime(new Date(startsAt ?? post.createdAt), { timeZone: CAIRO, ...options })
          return (
            <li key={post.id} className={styles.pinnedItem}>
              <PostDialog href={href} postId={post.id} photos={row.files.some((f) => f.isImage)}>
                <PostDateLink
                  href={href}
                  id={`post-${post.id}`}
                  className={styles.pinnedCard}
                  data-kind={post.kind}
                  data-media={media}
                >
                  {media !== 'none' && (
                    <span className={styles.pinnedMedia}>
                      {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" loading="lazy" decoding="async" draggable={false} />
                      )}
                      {linkImage && link && (
                        <>
                          <LinkImage
                            src={linkImage}
                            fallback={
                              <span className={styles.pinnedHostMark} aria-hidden="true">
                                {(link.site ?? link.host).charAt(0).toUpperCase()}
                              </span>
                            }
                          />
                          <span className={styles.pinnedHost}>{link.site ?? link.host}</span>
                        </>
                      )}
                      {startsAt && (
                        <time dateTime={startsAt} className={styles.pinnedLeaf}>
                          <span className={styles.eventMonth}>{leaf({ month: 'short' })}</span>
                          <span className={styles.eventDay}>{leaf({ day: 'numeric' })}</span>
                        </time>
                      )}
                      {vote && (
                        <span className={styles.pinnedVote}>
                          {vote.options.slice(0, VOTE_ROWS).map((o) => {
                            const share = chosen ? Math.round((o.count / chosen) * 100) : 0
                            return (
                              <span key={o.id} className={styles.pinnedVoteRow}>
                                <span
                                  className={styles.pinnedVoteBar}
                                  style={{ inlineSize: `${share}%` }}
                                  aria-hidden="true"
                                />
                                <bdi className={styles.pinnedVoteLabel}>{o.label}</bdi>
                                <span className={styles.pinnedVoteShare}>{share}%</span>
                              </span>
                            )
                          })}
                        </span>
                      )}
                    </span>
                  )}
                  <span className={styles.pinnedText}>
                    <span className={styles.pinnedBadges}>
                      <Badge
                        size="sm"
                        tone={post.kind === 'announcement' ? 'info' : 'neutral'}
                        icon={<kind.icon size={12} />}
                      >
                        {tp(kind.label)}
                      </Badge>
                      {isFresh(row, lastVisit, me) && (
                        <Badge size="sm" tone="success">
                          {t('pinnedNew')}
                        </Badge>
                      )}
                    </span>
                    <span className={styles.pinnedTitle} dir="auto">
                      {title}
                    </span>
                    {text && (
                      <span className={styles.pinnedExcerpt} dir="auto">
                        {text}
                      </span>
                    )}
                    <span className={styles.pinnedMeta}>
                      <bdi className={styles.pinnedAuthor}>{author}</bdi>
                      <span aria-hidden="true">·</span>
                      <time dateTime={post.createdAt}>{when}</time>
                      {count.n > 0 && (
                        <span className={styles.pinnedCount}>
                          <count.icon size={13} strokeWidth={1.75} aria-hidden="true" />
                          <span className="sr-only">{count.label}</span>
                          <span aria-hidden="true">{count.n}</span>
                        </span>
                      )}
                    </span>
                  </span>
                </PostDateLink>
              </PostDialog>
            </li>
          )
        })}
      </PinnedScroller>
    </section>
  )
}
