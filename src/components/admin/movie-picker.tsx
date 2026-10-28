'use client'

import { useField, useLocale } from '@payloadcms/ui'
import type { JSONFieldClientProps } from 'payload'
import { useEffect, useId, useRef, useState } from 'react'

import { moviePosterUrl, type MovieSearchResult, type MovieSnapshot } from '@/lib/movie'
import styles from './movie-picker.module.css'

export function MoviePicker({ path, readOnly }: JSONFieldClientProps) {
  const { value, setValue, errorMessage, showError } = useField<MovieSnapshot | null>({ path })
  const locale = useLocale()
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MovieSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  async function load(id?: number) {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    try {
      const parameters = new URLSearchParams({ locale: String(locale?.code ?? 'en') })
      if (id) parameters.set('id', String(id))
      else parameters.set('query', query.trim())
      const response = await fetch(`/api/movies?${parameters}`, {
        credentials: 'same-origin',
        signal: controller.signal,
      })
      const data = (await response.json()) as {
        error?: string
        results?: MovieSearchResult[]
        movie?: MovieSnapshot
      }
      if (!response.ok) throw new Error(data.error ?? 'Could not load movies.')
      if (controller.signal.aborted) return
      if (data.movie) {
        setValue(data.movie)
        setResults([])
        setSearched(false)
      } else {
        setResults(data.results ?? [])
        setSearched(true)
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Could not load movies.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <div className={styles.picker}>
      <label htmlFor={inputId}>Movie title</label>
      <div className={styles.search}>
        <input
          id={inputId}
          type="search"
          value={query}
          disabled={readOnly}
          placeholder="Search for a movie, then check its release year"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (!busy && query.trim().length >= 2) void load()
            }
          }}
        />
        <button
          type="button"
          disabled={readOnly || busy || query.trim().length < 2}
          onClick={() => void load()}
        >
          Search
        </button>
      </div>
      <div aria-live="polite">
        {busy && <p>Loading movies…</p>}
        {error && <p role="alert">{error}</p>}
        {showError && errorMessage && <p role="alert">{errorMessage}</p>}
        {searched && !busy && results.length === 0 && <p>No movies found. Try another title.</p>}
      </div>
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((movie) => (
            <li key={movie.id}>
              <button type="button" disabled={readOnly || busy} onClick={() => void load(movie.id)}>
                {moviePosterUrl(movie.posterPath) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={moviePosterUrl(movie.posterPath)} alt="" loading="lazy" />
                )}
                <span>
                  {movie.title} {movie.releaseDate ? `(${movie.releaseDate.slice(0, 4)})` : ''}
                  <small>{movie.originalTitle !== movie.title ? movie.originalTitle : ''}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && (
        <div className={styles.selection}>
          <strong>
            {value.title} ({value.releaseDate.slice(0, 4)})
          </strong>
          <p>
            {value.directors.join(', ')}
            {value.runtime ? ` · ${value.runtime} min` : ''}
          </p>
          <button type="button" disabled={readOnly || busy} onClick={() => void load(value.id)}>
            Refresh movie metadata
          </button>
          <button type="button" disabled={readOnly || busy} onClick={() => setValue(null)}>
            Remove selection
          </button>
        </div>
      )}
      <p className="field-description">
        Choose a result to save its title, poster, synopsis, runtime, genres, credits, and other
        movie details from TMDB.
      </p>
    </div>
  )
}
