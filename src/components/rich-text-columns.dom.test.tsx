import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { RichTextField } from '@/components/RichTextField'
import { flattenRichTextColumns } from '@/lib/flatten-rich-text-columns'

afterEach(cleanup)

const documentOf = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, direction: null, format: '', indent: 0 },
})

const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  children: [{ type: 'text', version: 1, text, format: 0, mode: 'normal', style: '', detail: 0 }],
})

const columns = (ratio = 'equal') => ({
  type: 'block',
  version: 2,
  fields: {
    id: 'layout-1',
    blockType: 'columns',
    ratio,
    first: documentOf([
      {
        type: 'upload',
        version: 3,
        relationTo: 'media',
        value: {
          id: 1,
          url: '/image.webp',
          alt: 'A classroom',
          mimeType: 'image/webp',
          width: 800,
          height: 600,
        },
      },
      paragraph('Image caption'),
    ]),
    second: documentOf([paragraph('Text beside the image')]),
  },
})

describe('rich text columns', () => {
  it.each(['equal', 'oneThird', 'twoThirds'])(
    'renders an image and text with %s widths',
    (ratio) => {
      const { container, getByAltText, getByText } = render(
        <RichTextField data={documentOf([columns(ratio)])} />,
      )
      const layout = container.querySelector(`[data-ratio="${ratio}"]`)
      expect(layout?.children).toHaveLength(2)
      expect(getByAltText('A classroom').getAttribute('src')).toBe('/image.webp')
      expect(layout?.firstElementChild?.textContent).toBe('Image caption')
      expect(layout?.lastElementChild?.textContent).toBe('Text beside the image')
      expect(getByText('Text beside the image')).toBeTruthy()
    },
  )

  it('keeps column text in plain views while omitting images', () => {
    const { container } = render(<RichTextField plain data={documentOf([columns()])} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('Image captionText beside the image')
  })

  it.each(['3', '4'])('renders and exports %s columns in reading order', (columnCount) => {
    const block = {
      ...columns('oneThird'),
      fields: {
        ...columns('oneThird').fields,
        columnCount,
        third: documentOf([paragraph('Third column')]),
        fourth: documentOf([paragraph('Fourth column')]),
      },
    }
    const data = documentOf([block]) as SerializedEditorState
    const { container } = render(<RichTextField data={data} />)
    expect(container.querySelector(`[data-columns="${columnCount}"]`)?.children).toHaveLength(
      Number(columnCount),
    )
    expect(container.textContent).toContain('Third column')
    expect(container.textContent?.includes('Fourth column')).toBe(columnCount === '4')
    const exported = JSON.stringify(flattenRichTextColumns(data))
    expect(exported).toContain('Third column')
    expect(exported.includes('Fourth column')).toBe(columnCount === '4')
  })

  it('preserves custom block converters alongside columns', () => {
    const { container } = render(
      <RichTextField
        data={documentOf([
          columns(),
          { type: 'block', version: 2, fields: { blockType: 'cardStack' } },
        ])}
        blocks={{ cardStack: () => <aside>Existing cards</aside> }}
      />,
    )
    expect(container.querySelector('img')).toBeTruthy()
    expect(container.querySelector('aside')?.textContent).toBe('Existing cards')
  })

  it('exports both columns in reading order without changing the saved document', () => {
    const data = documentOf([
      paragraph('Before'),
      columns(),
      paragraph('After'),
    ]) as SerializedEditorState
    const flattened = flattenRichTextColumns(data)
    expect(flattened.root.children.map((node) => node.type)).toEqual([
      'paragraph',
      'upload',
      'paragraph',
      'paragraph',
      'paragraph',
    ])
    expect(JSON.stringify(flattened)).toContain('Text beside the image')
    expect(data.root.children[1].type).toBe('block')
  })
})
