type Locale = 'en' | 'ar'
type Localized<T> = Partial<Record<Locale, T | null>>
export type EditorNode = { type: string; children?: EditorNode[]; [key: string]: unknown }
export type EditorDocument = { root: EditorNode & { children: EditorNode[] } }
export type ProgrammeEditorial = {
  overview?: Localized<EditorDocument>
  highlights?: Array<{ text?: Localized<string> }>
  testimonials?: Array<{
    quote?: Localized<string>
    attribution?: Localized<string>
    person?: number | null
  }>
}

export function programmeEditorial(
  source: ProgrammeEditorial,
  people: Record<number, Localized<string>> = {},
): Localized<EditorDocument> {
  const result = structuredClone(source.overview ?? {})
  const read = <T>(value: Localized<T> | undefined, locale: Locale) =>
    value?.[locale] ?? (locale === 'ar' ? value?.en : undefined)
  const text = (value: string): EditorNode => ({
    type: 'text',
    version: 1,
    text: value,
    format: 0,
    detail: 0,
    mode: 'normal',
    style: '',
  })
  const element = (type: string, children: EditorNode[]): EditorNode => ({
    type,
    version: 1,
    format: '',
    indent: 0,
    direction: null,
    children,
  })
  for (const locale of ['en', 'ar'] as const) {
    const own =
      source.overview?.[locale] != null ||
      source.highlights?.some((row) => row.text?.[locale] != null) ||
      source.testimonials?.some(
        (row) => row.quote?.[locale] != null || row.attribution?.[locale] != null,
      )
    if (!own) continue
    const body = read(source.overview, locale)
    if (body && !Array.isArray(body.root?.children)) throw new Error('Malformed programme overview')
    const highlights = (source.highlights ?? []).flatMap((row) => {
      const value = read(row.text, locale)
      return value ? [value] : []
    })
    const children: EditorNode[] = []
    if (highlights.length)
      children.push({
        ...element(
          'list',
          highlights.map((value, index) => ({
            ...element('listitem', [text(value)]),
            value: index + 1,
          })),
        ),
        listType: 'bullet',
        tag: 'ul',
        start: 1,
      })
    children.push(...structuredClone(body?.root.children ?? []))
    for (const [index, row] of (source.testimonials ?? []).entries()) {
      const quote = read(row.quote, locale)
      if (!quote) continue
      const nodes: EditorNode[] = quote
        .split(/\r?\n/)
        .flatMap((line, lineIndex) =>
          lineIndex ? [{ type: 'linebreak', version: 1 }, text(line)] : [text(line)],
        )
      const label =
        read(row.attribution, locale) || (row.person ? read(people[row.person], locale) : null)
      if (label) {
        nodes.push({ type: 'linebreak', version: 1 }, text('— '))
        nodes.push(
          row.person
            ? {
                type: 'inlineBlock',
                version: 1,
                fields: {
                  id: `testimonial-${index}-${locale}`,
                  blockType: 'mention',
                  type: 'person',
                  label,
                  person: row.person,
                },
              }
            : text(label),
        )
      } else if (row.person) {
        // Keep the relationship without inventing a public attribution.
        const first = nodes.findIndex((node) => node.type === 'text' && Boolean(node.text))
        if (first < 0) throw new Error('A linked testimonial needs nonempty quote text')
        nodes[first] = {
          type: 'inlineBlock',
          version: 1,
          fields: {
            id: `testimonial-${index}-${locale}`,
            blockType: 'mention',
            type: 'person',
            label: nodes[first].text,
            person: row.person,
          },
        }
      }
      children.push(element('quote', nodes))
    }
    if (!highlights.length && !(source.testimonials ?? []).some((row) => read(row.quote, locale)))
      continue
    result[locale] = {
      ...(body ?? {}),
      root: { ...element('root', children), ...(body?.root ?? {}), children },
    }
  }
  return result
}
