/**
 * The elements the Arc Markdown editor makes, and so the only ones a
 * Markdown text on the site renders: space posts and session descriptions
 * (spec §5, ADR 0011).
 */
export const MARKDOWN_ELEMENTS = [
  'p',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'hr',
  'strong',
  'em',
  'del',
  'a',
  'br',
] as const
