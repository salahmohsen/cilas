import { JSDOM } from 'jsdom'

const BLOCK = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'TABLE', 'TR', 'BLOCKQUOTE'])

/**
 * A Weebly page's content as plain text the extractor can read: headings as
 * `##`, bold as `**`, links as `[text](href)`, images as `![image](src)`, one
 * block per line. Navigation, scripts and styles are dropped.
 */
export const pageText = (html: string): string => {
  const { document, Node } = new JSDOM(html).window
  const root = document.querySelector('#wsite-content') ?? document.body
  root.querySelectorAll('script, style, noscript').forEach((el) => el.remove())

  const out: string[] = []
  let line = ''
  const flush = () => {
    const text = line.replace(/[ \t ​]+/g, ' ').trim()
    if (text) out.push(text)
    line = ''
  }

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      line += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName
    if (tag === 'BR') return flush()
    if (tag === 'IMG') {
      flush()
      out.push(`![image](${el.getAttribute('src') ?? ''})`)
      return
    }
    const block = BLOCK.has(tag)
    if (block) flush()
    if (/^H[1-4]$/.test(tag)) line += '## '
    const strong = tag === 'STRONG' || tag === 'B'
    const href = tag === 'A' ? el.getAttribute('href') : null
    if (strong) line += '**'
    if (href) line += '['
    el.childNodes.forEach(walk)
    if (href) line += `](${href})`
    if (strong) line += '**'
    if (block) flush()
  }

  walk(root)
  flush()
  return out.join('\n')
}
