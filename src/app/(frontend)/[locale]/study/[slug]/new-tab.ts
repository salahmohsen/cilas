/** An external registration link opens in a new tab; the site's apply page does not. */
export const newTab = (url: string) =>
  /^https?:/.test(url) ? { rel: 'noopener', target: '_blank' } : {}
