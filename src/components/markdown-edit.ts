import { htmlToMarkdown, markdownToHtml } from '@/components/arc/rich-text-editor/rich-text-editor'

/**
 * What the rich text editor reports for stored Markdown no one has touched:
 * its own rendering of it (for example `*it*` comes back as `_it_`). Browser only.
 */
export const markdownBaseline = (original: string): string =>
  htmlToMarkdown(markdownToHtml(original))

/**
 * The Markdown a form sends for an edited text. An edit that equals the
 * editor's own rendering of the original is no edit, so the original goes back
 * untouched and the server keeps what Markdown cannot carry (underline, images).
 */
export const markdownToSend = (original: string, edited: string, baseline: string): string =>
  edited.trim() === baseline.trim() ? original : edited
