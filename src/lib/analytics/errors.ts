/**
 * Errors that say nothing about the site: a request someone cancelled, a
 * browser extension, a bot looking for WordPress. Counting them would bury
 * the real ones, and the free plan counts every one.
 */
const NOISE = [
  /\bAbortError\b|\baborted\b/i,
  /\bLoad failed\b/i,
  /\bFailed to fetch\b/i,
  /\bNetworkError\b/i,
  /ResizeObserver loop/i,
  /\bNon-Error promise rejection\b/i,
  /\bScript error\.?$/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /\bNEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)\b/,
  /\bDynamic server usage\b/i,
]

const BOT_PATHS =
  /\/(wp-(admin|login|content|includes)|xmlrpc\.php|\.env|\.git|phpmyadmin|cgi-bin)\b|\.php\b/i

export const isNoisyError = (message: string | undefined, name?: string): boolean =>
  NOISE.some((pattern) => pattern.test(message ?? '') || pattern.test(name ?? ''))

export const isBotPath = (path: string | undefined): boolean => BOT_PATHS.test(path ?? '')
