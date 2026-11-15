import { isRelation as isObject } from '@/lib/relation'

/** Every text in a rich-text tree, joined. */
export const textOf = (node: unknown): string => {
  if (!isObject<{ text?: unknown; children?: unknown[]; root?: unknown }>(node)) return ''
  if (node.root) return textOf(node.root)
  return [
    typeof node.text === 'string' ? node.text : '',
    ...(node.children ?? []).map(textOf),
  ].join(' ')
}

/** The direction a text reads in: more Arabic letters than Latin ones reads right to left. */
export const directionOf = (text: string): 'rtl' | 'ltr' => {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  return arabic >= latin ? 'rtl' : 'ltr'
}

/**
 * The language a course's own text is written in, from its title, subtitle
 * and description as read: it may be the other language than the page's.
 */
export const courseLanguage = (course: {
  title: string
  subtitle?: string | null
  description?: unknown
}): 'ar' | 'en' =>
  directionOf(`${course.title} ${course.subtitle ?? ''} ${textOf(course.description)}`) === 'rtl'
    ? 'ar'
    : 'en'
