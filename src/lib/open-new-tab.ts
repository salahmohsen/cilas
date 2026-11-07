/** Opens an address in a new tab that cannot reach back to this page. */
export const openNewTab = (href: string) => {
  window.open(href, '_blank', 'noopener,noreferrer')
}
