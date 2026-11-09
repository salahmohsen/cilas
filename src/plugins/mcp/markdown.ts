import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Payload } from 'payload'

import { articleBodyFeatures } from '@/lexical/article-body'

import { ToolInputError } from './errors'

/** The same rule as the profile page: a link is a web or mail link, nothing else. */
const linksAreSafe = (markdown: string): boolean =>
  [...markdown.matchAll(/\]\(\s*<?([^)\s>]*)/g)].every(([, url]) =>
    /^(https?:|mailto:|#)/i.test(url ?? ''),
  )

export type MarkdownTarget = 'default' | 'article'

/**
 * Markdown to the Lexical state a field stores. A course description and a form's
 * confirmation use the site's default editor; an article body uses the article editor, so the
 * conversion knows the same nodes the field does.
 */
export const markdownToLexical = async (
  payload: Payload,
  target: MarkdownTarget,
  markdown: string,
): Promise<SerializedEditorState> => {
  if (!linksAreSafe(markdown)) {
    throw new ToolInputError(
      'A link in the Markdown does not start with https:, http: or mailto:. Use a web link or remove it.',
    )
  }
  const editorConfig = await (target === 'article'
    ? editorConfigFactory.fromFeatures({ config: payload.config, features: articleBodyFeatures })
    : editorConfigFactory.default({ config: payload.config }))
  return convertMarkdownToLexical({ editorConfig, markdown })
}
