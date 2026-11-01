import { Film } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

import { moviePosterUrl, type MovieSnapshot } from '@/lib/movie'
import { EVENT_POSTER_COLORS } from '@/lib/event-poster-colors'
import { subtitleLanguageNames } from '@/lib/subtitle-languages'
import { MovieDetailsDialog } from './movie-details-dialog'
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
  const released = /^\d{4}-\d{2}-\d{2}$/.test(movie.releaseDate)
    ? format.dateTime(new Date(`${movie.releaseDate}T12:00:00Z`), {
        dateStyle: 'long',
        timeZone: 'UTC',
      })
    : movie.releaseDate
  const money = (n: number) =>
    n > 0 ? format.number(n, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : ''
  // The card keeps who made it and how it is shown; the rest is in the dialog.
  const metadata = [
    [t('director'), join(movie.directors)],
    [t('writers'), join(movie.writers)],
    [t('genres'), join(movie.genres)],
    [t('languages'), join(movie.languages)],
    [t('subtitles'), join(subtitles)],
  ].filter(([, value]) => value)
  const allMetadata = [
    [t('originalTitle'), movie.originalTitle !== movie.title ? movie.originalTitle : ''],
    [t('director'), join(movie.directors)],
    [t('writers'), join(movie.writers)],
    [t('released'), released],
    [t('runtime'), movie.runtime ? t('minutes', { count: movie.runtime }) : ''],
    [t('genres'), join(movie.genres)],
    [t('countries'), join(movie.countries)],
    [t('languages'), join(movie.languages)],
    [t('subtitles'), join(subtitles)],
    [t('studios'), join(movie.studios)],
    [
      t('rating'),
      movie.voteCount
        ? `${format.number(movie.rating, { maximumFractionDigits: 1 })} / 10 · ${t('votes', { count: movie.voteCount })}`
        : '',
    ],
    [t('budget'), money(movie.budget)],
    [t('revenue'), money(movie.revenue)],
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
      {/* The facts' grid; its last cell opens the rest of the metadata. */}
      <div className={styles.facts}>
        <dl className={styles.factList}>
          {metadata.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd dir="auto">{value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.detailsCell}>
          <MovieDetailsDialog
            className={styles.detailsTrigger}
            closeLabel={t('close')}
            label={t('allDetails')}
            title={movie.title}
          >
            <div className={styles.details}>
              <dl>
                {allMetadata.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd dir="auto">{value}</dd>
                  </div>
                ))}
              </dl>
              {movie.cast.length > 0 && (
                <section>
                  <h4>{t('cast')}</h4>
                  <ul>
                    {movie.cast.map((c) => (
                      <li dir="auto" key={`${c.name}-${c.character}`}>
                        {c.character ? `${c.name} · ${c.character}` : c.name}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {movie.crew.length > 0 && (
                <section>
                  <h4>{t('crew')}</h4>
                  <ul>
                    {movie.crew.map((c) => (
                      <li dir="auto" key={`${c.name}-${c.job}`}>
                        {`${c.name} · ${c.job}`}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <p className={styles.detailsLinks}>
                <a
                  href={`https://www.themoviedb.org/movie/${movie.id}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('source')}
                </a>
                {movie.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdbId}/`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    IMDb
                  </a>
                )}
              </p>
              <section aria-label={t('attributionLink')} className={styles.attribution}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="TMDB" src="/assets/images/tmdb.svg" width={90} />
                <p lang="en">
                  This product uses the TMDB API but is not endorsed or certified by TMDB.
                </p>
              </section>
            </div>
          </MovieDetailsDialog>
        </div>
      </div>
    </article>
  )
}
