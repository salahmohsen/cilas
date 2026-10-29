/** Where to go after signing in. Only a path on this site, never `//elsewhere`. */
export const safeNext = (value: string | null | undefined): string =>
  value &&
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.startsWith('/\\') &&
  !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    ? value
    : '/'
