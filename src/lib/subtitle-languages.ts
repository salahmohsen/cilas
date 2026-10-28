import options from './subtitle-languages.json'

/** ISO language choices from TMDB's /configuration/languages endpoint. */
export const SUBTITLE_LANGUAGE_OPTIONS = options
const supported = new Set(options.map(({ value }) => value))

export function subtitleLanguageNames(codes: readonly string[], locale: string) {
  const names = new Intl.DisplayNames([locale], { type: 'language' })
  return [...new Set(codes)]
    .filter((code) => supported.has(code))
    .map((code) => names.of(code) ?? code)
}
