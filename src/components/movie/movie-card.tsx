import { ArrowRight, Film } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

import { moviePosterUrl, type MovieSnapshot } from '@/lib/movie'
import { EVENT_POSTER_COLORS } from '@/lib/event-poster-colors'
import { subtitleLanguageNames } from '@/lib/subtitle-languages'
import { HoverCard } from '@/components/arc/hover-card/hover-card'
import styles from './movie-card.module.css'

export function MovieCard({
  movie,
  subtitleLanguages = [],
}: {
  movie: MovieSnapshot
  subtitleLanguages?: string[]
}) {
  const t = useTranslations('Movie')
  const locale = useLocale()
  const format = useFormatter()
  const join = (items: string[]) => items.join(locale === 'ar' ? '، ' : ', ')
  const poster = moviePosterUrl(movie.posterPath)
  const subtitles = subtitleLanguageNames(subtitleLanguages, locale)
  const metadata = [
    [t('director'), join(movie.directors)],
    [t('writers'), join(movie.writers)],
    [
      t('released'),
      /^\d{4}-\d{2}-\d{2}$/.test(movie.releaseDate)
        ? format.dateTime(new Date(`${movie.releaseDate}T12:00:00Z`), {
            dateStyle: 'long',
            timeZone: 'UTC',
          })
        : movie.releaseDate,
    ],
    [t('runtime'), movie.runtime ? t('minutes', { count: movie.runtime }) : ''],
    [t('genres'), join(movie.genres)],
    [t('countries'), join(movie.countries)],
    [t('languages'), join(movie.languages)],
    [t('subtitles'), join(subtitles)],
  ].filter(([, value]) => value)
  return (
    <article
      className={`poster ${styles.card} not-prose`}
      style={{ '--poster-color': EVENT_POSTER_COLORS.screening } as CSSProperties}
    >
      <div className={styles.main}>
        <div className={styles.poster}>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={movie.title} loading="lazy" />
          ) : (
            <Film size={48} strokeWidth={1.5} aria-hidden />
          )}
        </div>
        <div className={styles.content}>
          <header className={styles.header}>
            <h3 dir="auto">
              {movie.title}
              {movie.releaseDate ? ` (${movie.releaseDate.slice(0, 4)})` : ''}
            </h3>
            {movie.originalTitle !== movie.title && (
              <p className={styles.muted} dir="auto">
                {movie.originalTitle}
              </p>
            )}
          </header>
          <div className={styles.body}>
            {movie.tagline && <p dir="auto">{movie.tagline}</p>}
            {movie.overview && <p dir="auto">{movie.overview}</p>}
          </div>
        </div>
      </div>
      <dl className={styles.facts}>
        {metadata.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd dir="auto">{value}</dd>
          </div>
        ))}
      </dl>
      <footer className={styles.footer} data-links={movie.imdbId ? 3 : 2}>
        <a
          href={`https://www.themoviedb.org/movie/${movie.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="poster-action">
            {t('source')}
            <ArrowRight size={16} strokeWidth={2} aria-hidden className="poster-arrow" />
          </span>
        </a>
        {movie.imdbId && (
          <a
            href={`https://www.imdb.com/title/${movie.imdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="poster-action">
              IMDb
              <ArrowRight size={16} strokeWidth={2} aria-hidden className="poster-arrow" />
            </span>
          </a>
        )}
        <HoverCard
          side="top"
          content={
            <section className={styles.creditPreview} aria-label={t('attributionLink')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/images/tmdb.svg" width={90} alt="TMDB" />
              <p lang="en">
                This product uses the TMDB API but is not endorsed or certified by TMDB.
              </p>
            </section>
          }
        >
          <button type="button" className={styles.creditTrigger}>
            <span className="poster-action">
              {t('attributionTrigger')}
              <ArrowRight size={16} strokeWidth={2} aria-hidden className="poster-arrow" />
            </span>
          </button>
        </HoverCard>
      </footer>
    </article>
  )
}
