/** Where to go after signing in. Only a path on this site, never `//elsewhere`. */
export const safeNext = (value: string | null | undefined): string =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/'
