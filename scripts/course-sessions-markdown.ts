import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Payload } from 'payload'

/**
 * Old session descriptions (Lexical, the project's default editor) as
 * Markdown, for the fill and verify scripts. An empty editor state is ''
 * (the converter refuses a root with no children).
 */
export const lexicalToMarkdown = async (payload: Payload) => {
  const editorConfig = await editorConfigFactory.default({ config: payload.config })
  return (lexical: unknown): string => {
    const state = lexical as SerializedEditorState | null
    return state?.root?.children?.length
      ? convertLexicalToMarkdown({ data: state, editorConfig })
      : ''
  }
}
