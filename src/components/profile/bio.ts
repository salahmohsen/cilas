import { htmlToMarkdown, markdownToHtml } from '@/components/arc/rich-text-editor/rich-text-editor'

/**
 * What the rich text editor reports for a stored bio the member has not touched:
 * its own rendering of it (for example `*it*` comes back as `_it_`). Browser only.
 */
export const bioBaseline = (original: string): string => htmlToMarkdown(markdownToHtml(original))

/**
 * The Markdown the form sends for a bio. An edit that equals the editor's own
 * rendering of the original is no edit, so the original goes back untouched
 * and the server keeps what Markdown cannot carry (underline, images).
 */
export const bioToSend = (original: string, edited: string, baseline: string): string =>
  edited.trim() === baseline.trim() ? original : edited
