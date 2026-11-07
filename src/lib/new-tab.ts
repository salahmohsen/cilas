export const newTab = (url: string) =>
  /^https?:/.test(url) ? { rel: 'noopener', target: '_blank' } : {}
