/**
 * Scrolls to a section on this page and records its hash, every time it is
 * asked. A link to the hash the address already has is not a navigation, so
 * the router does nothing on the second click; this does not depend on the
 * address changing. The section takes focus (without a second scroll), so
 * keyboard and screen-reader users land there too. False when the section is
 * not on the page, so the caller can let the link navigate instead.
 */
export const scrollToSection = (id: string, { reduced = false } = {}): boolean => {
  const section = document.getElementById(id)
  if (!section) return false
  section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  if (window.location.hash !== `#${id}`)
    window.history.replaceState(window.history.state, '', `#${id}`)
  if (!section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1')
  section.focus({ preventScroll: true })
  return true
}
