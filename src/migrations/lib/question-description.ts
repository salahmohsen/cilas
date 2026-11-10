/** Snapshot of the former form help-text autolinking rule, for the text-to-Lexical migration. */
export const questionDescription = (text: string) => {
  const node = (text: string) => ({ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 })
  return { root: { type: 'root', format: '' as const, indent: 0, direction: null, version: 1, children: text.split(/\r?\n/).map(line => ({
    type: 'paragraph', format: '', indent: 0, direction: null, version: 1, textFormat: 0,
    children: line.split(/(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]])/g).map((part, i) => i % 2 ? {
      type: 'link', version: 3, format: '', indent: 0, direction: null,
      fields: { linkType: 'custom', url: part, newTab: true },
      children: [node(part.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))],
    } : node(part)).filter(n => !('text' in n) || n.text !== ''),
  })) } }
}
