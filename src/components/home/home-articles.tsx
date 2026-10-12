'use client'

import { useTranslations } from 'next-intl'

import { Carousel } from '@/components/arc/carousel/carousel'
import type { ArticleCard } from '@/lib/article-cards'

/**
 * The featured articles, one in the middle and its neighbours peeking in,
 * to drag, swipe or step through. The carousel moves left to right in both
 * languages; each card keeps its own direction.
 */
export function HomeArticles({ posts, title }: { posts: ArticleCard[]; title: string }) {
  const t = useTranslations('Home.controls')
  return (
    <div dir="ltr">
      <Carousel
        // With three or more, start on the second, so a neighbour shows on each side.
        defaultIndex={posts.length > 2 ? 1 : 0}
        // Turns on its own and starts over after the last; stops on hover,
        // focus, its pause button or reduced motion.
        autoplay
        interval={6000}
        label={title}
        labels={{
          slides: t('slides'),
          pause: t('pauseRotation'),
          play: t('startRotation'),
          choose: t('choose'),
          previous: t('previous'),
          next: t('next'),
        }}
        slideLabel={(i, count) => t('position', { position: i + 1, total: count })}
        slideSize="min(84cqw, 420px)"
      >
        {posts.map((post) => (
          <a className="home-article" dir="auto" href={post.href} key={post.id}>
            {post.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={post.image.alt}
                className="home-article-image"
                draggable={false}
                src={post.image.src}
              />
            ) : (
              <span aria-hidden className="home-article-image" />
            )}
            <span className="home-article-meta">{post.category}</span>
            <span className="home-article-title">{post.title}</span>
            <span className="home-article-byline">
              {post.author.name}
              {post.author.name && post.dateLabel ? <span aria-hidden> · </span> : null}
              {post.dateLabel}
            </span>
          </a>
        ))}
      </Carousel>
    </div>
  )
}
