const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
}

/** Text made safe to put inside HTML, in an element or a quoted attribute. */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!)

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/**
 * HTML text back to plain text: the named entities above and numeric ones.
 * One pass, so "&amp;lt;" becomes "&lt;", not "<".
 */
export const decodeEntities = (html: string): string =>
  html.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi, (entity, dec, hex, name) => {
    if (name) return NAMED[name.toLowerCase()]!
    const code = dec ? Number(dec) : Number.parseInt(hex, 16)
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity
  })
