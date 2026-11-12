'use client'
/* eslint-disable @next/next/no-img-element -- the 24px author avatar stays a plain image; post images use next/image. */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { motionTokens } from '../../lib/motion-tokens'
import { activatePage, pageNavigation } from '../../lib/page-navigation'
import { blogCategories, blogPosts } from './blog-grid-data'
import type { BlogPost } from './blog-grid-data'
import styles from './blog-grid.module.css'

/* A card's image width: a third of the 1180px page, two columns under 900px
   of container, one under 680px (blog-grid.module.css). The featured card's
   image takes 1.35 of 2.35 parts of the row. */
const CARD_IMAGE_SIZES =
  '(min-width: 74rem) 380px, (min-width: 57rem) 33vw, (min-width: 43rem) 50vw, 100vw'
const FEATURED_IMAGE_SIZES = '(min-width: 74rem) 680px, (min-width: 43rem) 58vw, 100vw'

export type { BlogAuthor, BlogPost } from './blog-grid-data'

export interface BlogGridLabels {
  all?: string
  allPosts?: string
  filterBy?: string
  pagination?: string
  previous?: string
  next?: string
  previousPage?: string
  nextPage?: string
  page?: (n: number) => string
  /** How a page number is written, for other digits. */
  number?: (n: number) => string
  empty?: (category: string) => string
}

export interface BlogGridProps {
  getPageHref?: (page: number, category: string) => string
  title?: string
  description?: string
  posts?: BlogPost[]
  /** Category filter labels, in order. "All" is added in front. */
  categories?: string[]
  /** Active category, or "All" (controlled). */
  category?: string
  defaultCategory?: string
  onCategoryChange?: (category: string) => void
  /** One based page (controlled). */
  page?: number
  defaultPage?: number
  onPageChange?: (page: number) => void
  /** Cards per page below the featured post. Defaults to 6. */
  pageSize?: number
  /** Shows the newest post of the current filter as a large card on page one. Defaults to true. */
  showFeatured?: boolean
  /** `newest` sorts by date; `given` keeps the order of `posts`. Defaults to `newest`. */
  order?: 'newest' | 'given'
  /** Shows the title and description. Off when the page gives the block its own heading; `title` still names the section. */
  header?: boolean
  /** Drops the block's own width and padding, to sit inside a page's column. */
  flush?: boolean
  /** Shown in the image frame of a post without an image, so every card keeps its frame. */
  imageFallback?: (post: BlogPost) => ReactNode
  /** Post ids in reading order, per category: a category listed here keeps that order instead of newest first, and leads with its first post. */
  categoryOrder?: Record<string, string[]>
  /** Server-rendered cards by post id, using this block's filtering and pagination. */
  cards?: Record<string, ReactNode>
  /** Link for each post. When set, cards render as links and the in-place reader is off. */
  getHref?: (post: BlogPost) => string
  /** Interface text, for other languages. */
  labels?: BlogGridLabels
  /** Called when a post opens, from a link or the in-place reader. */
  onPostOpen?: (post: BlogPost) => void
  className?: string
}

const smooth = motionTokens.spring.smooth
const morph = motionTokens.spring.morph
const standard = [...motionTokens.ease.standard] as [number, number, number, number]
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`))

function useControllable<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [inner, setInner] = useState(initial)
  const current = value !== undefined ? value : inner
  const set = (next: T) => {
    if (value === undefined) setInner(next)
    onChange?.(next)
  }
  return [current, set] as const
}

/** Springs its height when the page or filter changes, so the pagination below glides instead of jumping. Other resizes (a late font, a narrower window) apply at once. */
function AutoHeight({
  changeKey,
  reduced,
  className,
  children,
}: {
  changeKey: string
  reduced: boolean
  className?: string
  children: ReactNode
}) {
  const clipRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const height = useMotionValue<number | 'auto'>('auto')
  const lastKey = useRef(changeKey),
    armedUntil = useRef(0)
  useLayoutEffect(() => {
    if (lastKey.current === changeKey) return
    lastKey.current = changeKey
    armedUntil.current = performance.now() + 900
  }, [changeKey])
  useEffect(() => {
    const clip = clipRef.current,
      content = contentRef.current
    if (!clip || !content || typeof ResizeObserver === 'undefined') return
    let controls: ReturnType<typeof animate> | undefined
    const observer = new ResizeObserver(() => {
      const next = content.offsetHeight
      controls?.stop()
      if (!next || reduced || height.get() === 'auto' || performance.now() > armedUntil.current) {
        height.jump(next || 'auto')
        delete clip.dataset.clip
        return
      }
      clip.dataset.clip = ''
      controls = animate(height, next, {
        ...smooth,
        onComplete: () => {
          delete clip.dataset.clip
        },
      })
    })
    observer.observe(content)
    return () => {
      observer.disconnect()
      controls?.stop()
    }
  }, [height, reduced])
  return (
    <motion.div ref={clipRef} className={styles.clip} style={{ height }}>
      <div ref={contentRef} className={className}>
        {children}
      </div>
    </motion.div>
  )
}

function Meta({ post }: { post: BlogPost }) {
  return (
    <p className={styles.meta}>
      <span>{post.label ?? post.category}</span>
      {post.dateLabel !== '' && (
        <>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{post.dateLabel ?? formatDate(post.date)}</time>
        </>
      )}
    </p>
  )
}

function Byline({ post }: { post: BlogPost }) {
  const named = post.author.name.trim() !== ''
  if (!named && post.readTimeLabel === '') return null
  return (
    <div className={styles.byline}>
      {named && (
        <>
          {post.author.avatar ? (
            <img
              className={styles.avatar}
              src={post.author.avatar}
              alt=""
              width={24}
              height={24}
              loading="lazy"
            />
          ) : (
            <span className={styles.avatar} aria-hidden="true">
              {post.author.name.trim().charAt(0)}
            </span>
          )}
          <span className={styles.authorName} dir="auto">
            {post.author.name}
          </span>
        </>
      )}
      {post.readTimeLabel !== '' && (
        <span className={styles.readTime}>{post.readTimeLabel ?? `${post.readTime} min read`}</span>
      )}
    </div>
  )
}

/** A card's content, shared by the grid's cards and any other place that wants a card: its image, then its category and date, its title, its excerpt and its byline. */
export function BlogCardBody({
  post,
  featured = false,
  imageLayoutId,
  imageFallback,
  eager = false,
  imageSizing = 'ratio',
}: {
  post: BlogPost
  featured?: boolean
  /** The shared image's layout id, so it morphs into the reader; left out elsewhere. */
  imageLayoutId?: string
  /** Shown in the image frame of a post without an image, so every card keeps its frame. */
  imageFallback?: () => ReactNode
  eager?: boolean
  /** Match a featured card's image height to its text instead of imposing an aspect ratio. */
  imageSizing?: 'ratio' | 'content'
}) {
  return (
    <>
      {post.image ? (
        <motion.div
          layoutId={imageLayoutId}
          transition={morph}
          className={styles.imageFrame}
          data-image-sizing={imageSizing}
        >
          <Image
            className={styles.image}
            src={post.image.src}
            alt={post.image.alt}
            fill
            sizes={featured ? FEATURED_IMAGE_SIZES : CARD_IMAGE_SIZES}
            style={{ objectPosition: `${post.image.focalX ?? 50}% ${post.image.focalY ?? 50}%` }}
            loading={eager ? 'eager' : 'lazy'}
          />
        </motion.div>
      ) : imageFallback ? (
        <div className={styles.imageFrame} data-fallback="">
          {imageFallback()}
        </div>
      ) : null}
      <div className={styles.cardBody}>
        <Meta post={post} />
        <h3 className={featured ? styles.featuredTitle : styles.cardTitle} dir="auto">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className={styles.excerpt} dir="auto">
            {post.excerpt}
          </p>
        ) : null}
        <Byline post={post} />
      </div>
    </>
  )
}

export function BlogGrid({
  title = 'Journal',
  description = 'Product news, design notes and engineering deep dives from the team.',
  posts = blogPosts,
  categories = blogCategories,
  category: categoryProp,
  defaultCategory = 'All',
  onCategoryChange,
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  getPageHref,
  pageSize = 6,
  showFeatured = true,
  order: sortOrder = 'newest',
  header = true,
  flush = false,
  imageFallback,
  cards,
  categoryOrder,
  getHref,
  onPostOpen,
  labels = {},
  className,
}: BlogGridProps) {
  const reduced = useReducedMotion()
  const uid = useId()
  const rootRef = useRef<HTMLElement>(null)
  const [category, setCategoryState] = useControllable(
    categoryProp,
    defaultCategory,
    onCategoryChange,
  )
  const [page, setPageState] = useControllable(pageProp, defaultPage, onPageChange)
  const [direction, setDirection] = useState(0)
  const [reading, setReading] = useState<BlogPost | null>(null)
  /** The post the reader just closed. Its image morphs back into its card while the rest of the index fades in around it. */
  const [returning, setReturning] = useState<string | null>(null)
  const lastOpened = useRef<string | null>(null)

  const sorted =
    sortOrder === 'given' ? posts : [...posts].sort((a, b) => b.date.localeCompare(a.date))
  const order = category === 'All' ? undefined : categoryOrder?.[category]
  const inCategory =
    category === 'All' ? sorted : sorted.filter((post) => post.category === category)
  const filtered = order
    ? [
        ...order.flatMap((id) => inCategory.filter((post) => post.id === id)),
        ...inCategory.filter((post) => !order.includes(post.id)),
      ]
    : inCategory
  const featured =
    showFeatured && filtered.length > 1
      ? order
        ? filtered[0]
        : (filtered.find((post) => post.featured) ?? filtered[0])
      : null
  const rest = featured ? filtered.filter((post) => post !== featured) : filtered
  const pageCount = Math.max(1, Math.ceil(rest.length / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const pagePosts = rest.slice((safePage - 1) * pageSize, safePage * pageSize)
  const PageControl = getPageHref ? 'a' : 'button'
  const navigation = (number: number, disabled = false) =>
    pageNavigation(disabled, getPageHref?.(number, category))

  function scrollToTop() {
    const node = rootRef.current
    if (node && node.getBoundingClientRect().top < 0)
      node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }
  function setCategory(next: string) {
    if (next === category) return
    setDirection(0)
    setReturning(null)
    setPageState(1)
    setCategoryState(next)
  }
  function setPage(next: number) {
    if (next === safePage || next < 1 || next > pageCount) return
    setDirection(next > safePage ? 1 : -1)
    setReturning(null)
    setPageState(next)
    scrollToTop()
  }
  function open(post: BlogPost, event: MouseEvent) {
    onPostOpen?.(post)
    if (getHref) return
    event.preventDefault()
    lastOpened.current = post.id
    setReading(post)
    scrollToTop()
  }
  function close() {
    setReturning(lastOpened.current)
    setReading(null)
    requestAnimationFrame(() => {
      const card = rootRef.current?.querySelector<HTMLElement>(
        `[data-post="${lastOpened.current}"]`,
      )
      card?.focus({ preventScroll: true })
      card?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    })
  }

  const renderCard = (post: BlogPost, isFeatured = false) => {
    if (cards?.[post.id])
      return (
        <div key={post.id} data-post={post.id}>
          {cards[post.id]}
        </div>
      )
    const href = getHref?.(post)
    const inner = (
      <BlogCardBody
        post={post}
        featured={isFeatured}
        eager={isFeatured}
        imageLayoutId={reduced ? undefined : `${uid}-image-${post.id}`}
        imageFallback={imageFallback ? () => imageFallback(post) : undefined}
      />
    )
    const className = isFeatured ? styles.featured : styles.card
    const fades = returning !== null && (reduced || post.id !== returning)
    return (
      <motion.a
        key={post.id}
        className={className}
        href={href ?? `#${post.id}`}
        data-post={post.id}
        onClick={(event) => open(post, event)}
        {...enterFade(fades)}
      >
        {inner}
      </motion.a>
    )
  }

  /** Fades a piece of the index or reader in on its own, so the shared image is never dimmed by a fading parent mid morph. */
  const enterFade = (on: boolean) => ({
    initial: on ? { opacity: 0 } : (false as const),
    animate: { opacity: 1 },
    transition: { duration: motionTokens.duration.standard, ease: standard },
  })
  const back = returning !== null
  const tabs = ['All', ...categories]
  const pageKey = `${category}-${safePage}`

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(' ')}
      aria-label={title}
      data-flush={flush || undefined}
    >
      <LayoutGroup id={uid}>
        <div className={styles.inner}>
          <AnimatePresence mode="popLayout" initial={false}>
            {reading ? (
              <motion.article
                key="reader"
                className={styles.reader}
                exit={{
                  opacity: 0,
                  transition: { duration: motionTokens.duration.exit, ease: standard },
                }}
                aria-labelledby={`${uid}-reader-title`}
              >
                <motion.button
                  type="button"
                  className={styles.back}
                  onClick={close}
                  autoFocus
                  {...enterFade(true)}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  {labels.allPosts ?? 'All posts'}
                </motion.button>
                <motion.header className={styles.readerHead} {...enterFade(true)}>
                  <Meta post={reading} />
                  <h2 id={`${uid}-reader-title`} className={styles.readerTitle}>
                    {reading.title}
                  </h2>
                  <Byline post={reading} />
                </motion.header>
                {reading.image && (
                  <motion.div
                    layoutId={reduced ? undefined : `${uid}-image-${reading.id}`}
                    className={styles.readerImage}
                    // The fade's own transition wins when motion is reduced.
                    {...(reduced ? enterFade(true) : { transition: morph })}
                  >
                    <Image
                      className={styles.image}
                      src={reading.image.src}
                      alt={reading.image.alt}
                      fill
                      sizes="(min-width: 48rem) 760px, 100vw"
                      style={{
                        objectPosition: `${reading.image.focalX ?? 50}% ${reading.image.focalY ?? 50}%`,
                      }}
                    />
                  </motion.div>
                )}
                <motion.div
                  className={styles.readerBody}
                  initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...smooth, delay: reduced ? 0 : 0.12 }}
                >
                  <p className={styles.lead}>{reading.excerpt}</p>
                  {(reading.body ?? []).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </motion.div>
              </motion.article>
            ) : (
              <motion.div
                key="index"
                className={styles.index}
                exit={{
                  opacity: 0,
                  transition: { duration: motionTokens.duration.exit, ease: standard },
                }}
              >
                {header && (
                  <motion.header className={styles.header} {...enterFade(back)}>
                    <h2 className={styles.title}>{title}</h2>
                    {description && <p className={styles.description}>{description}</p>}
                  </motion.header>
                )}

                {categories.length > 0 && (
                  <motion.div
                    className={styles.filters}
                    role="group"
                    aria-label={labels.filterBy ?? 'Filter by category'}
                    {...enterFade(back)}
                  >
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={styles.filter}
                        aria-pressed={tab === category}
                        onClick={() => setCategory(tab)}
                      >
                        {tab === category && (
                          <motion.span
                            layoutId={`${uid}-filter`}
                            className={styles.filterHighlight}
                            transition={reduced ? { duration: 0 } : morph}
                          />
                        )}
                        <span>{tab === 'All' ? (labels.all ?? 'All') : tab}</span>
                      </button>
                    ))}
                  </motion.div>
                )}

                <AutoHeight
                  changeKey={`${pageKey}-${pageCount}`}
                  reduced={Boolean(reduced)}
                  className={styles.stack}
                >
                  <AnimatePresence mode="wait" initial={false} custom={direction}>
                    <motion.div
                      key={pageKey}
                      className={styles.page}
                      initial={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, x: direction * 24, y: direction ? 0 : 10 }
                      }
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: direction * -24,
                              transition: { duration: motionTokens.duration.exit, ease: standard },
                            }
                      }
                      transition={{
                        ...smooth,
                        opacity: { duration: motionTokens.duration.standard },
                      }}
                    >
                      {featured && safePage === 1 && renderCard(featured, true)}
                      {pagePosts.length > 0 && (
                        <div className={styles.grid}>
                          {pagePosts.map((post) => renderCard(post))}
                        </div>
                      )}
                      {filtered.length === 0 && (
                        <p className={styles.empty}>
                          {labels.empty ? labels.empty(category) : `No posts in ${category} yet.`}
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  <AnimatePresence initial={back}>
                    {pageCount > 1 && (
                      <motion.nav
                        key="pagination"
                        className={styles.pagination}
                        aria-label={labels.pagination ?? 'Pagination'}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{
                          opacity: 0,
                          transition: { duration: motionTokens.duration.exit, ease: standard },
                        }}
                        transition={{ duration: motionTokens.duration.standard, ease: standard }}
                      >
                        <PageControl
                          {...navigation(safePage - 1, safePage === 1)}
                          onClick={(event: MouseEvent<HTMLElement>) => {
                            if (activatePage(event, safePage === 1, Boolean(getPageHref)))
                              setPage(safePage - 1)
                          }}
                          className={styles.pageStep}
                          aria-label={labels.previousPage ?? 'Previous page'}
                        >
                          <ChevronLeft size={16} aria-hidden="true" />
                          <span>{labels.previous ?? 'Previous'}</span>
                        </PageControl>
                        <div className={styles.pageNumbers}>
                          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                            (number) => (
                              <PageControl
                                {...navigation(number)}
                                onClick={(event: MouseEvent<HTMLElement>) => {
                                  if (activatePage(event, false, Boolean(getPageHref)))
                                    setPage(number)
                                }}
                                key={number}
                                className={styles.pageNumber}
                                aria-current={number === safePage ? 'page' : undefined}
                                aria-label={labels.page ? labels.page(number) : `Page ${number}`}
                              >
                                {number === safePage && (
                                  <motion.span
                                    key="highlight"
                                    layoutId={`${uid}-page`}
                                    className={styles.pageHighlight}
                                    transition={reduced ? { duration: 0 } : morph}
                                  />
                                )}
                                <span key="label">
                                  {labels.number ? labels.number(number) : number}
                                </span>
                              </PageControl>
                            ),
                          )}
                        </div>
                        <PageControl
                          {...navigation(safePage + 1, safePage === pageCount)}
                          onClick={(event: MouseEvent<HTMLElement>) => {
                            if (activatePage(event, safePage === pageCount, Boolean(getPageHref)))
                              setPage(safePage + 1)
                          }}
                          className={styles.pageStep}
                          aria-label={labels.nextPage ?? 'Next page'}
                        >
                          <span>{labels.next ?? 'Next'}</span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </PageControl>
                      </motion.nav>
                    )}
                  </AnimatePresence>
                </AutoHeight>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </section>
  )
}

/** Preview: the blog index with the in-place reader. */
export function BlogGridBlock() {
  return <BlogGrid />
}

export default BlogGridBlock
