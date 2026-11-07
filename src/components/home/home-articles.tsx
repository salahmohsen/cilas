'use client'

import { useTranslations } from 'next-intl'

import { BlogCardBody } from '@/components/arc/blocks/blog-grid/blog-grid'
import styles from '@/components/arc/blocks/blog-grid/blog-grid.module.css'
import { Carousel } from '@/components/arc/carousel/carousel'
import { CilasLogo } from '@/components/cilas-logo'
import type { ArticleCard } from '@/lib/article-cards'

/**
 * The latest articles, one in the middle and its neighbours peeking in,
 * to drag, swipe or step through, its controls together on the left. Each
 * slide is a card like the featured grid's, category, image, title, excerpt
 * and byline included. It runs left to right in both languages; each card
 * keeps its own direction.
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
        controlsAt="start"
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
          <a className={styles.card} dir="auto" href={post.href} key={post.id}>
            <BlogCardBody
              imageFallback={() => <CilasLogo className="article-fallback-logo" />}
              post={post}
            />
          </a>
        ))}
      </Carousel>
    </div>
  )
}
