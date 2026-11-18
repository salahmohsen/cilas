import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import Link from 'next/link'

import { RichTextField } from '@/components/RichTextField'

afterEach(cleanup)

const data = {
  root: {
    type: 'root',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        children: [
          {
            type: 'inlineBlock',
            version: 1,
            fields: { blockType: 'mention', id: 'mona', type: 'person', person: 1, label: 'Mona' },
          },
        ],
      },
    ],
  },
}

describe('rich text mentions', () => {
  it.each([false, true])('keeps mention text visible with plain=%s', (plain) => {
    render(<RichTextField data={data} plain={plain} />)
    expect(screen.getByText('Mona')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('keeps caller-provided mention links', () => {
    render(
      <RichTextField
        data={data}
        inlineBlocks={{
          mention: (fields: { label: string }) => <Link href="/people/mona">{fields.label}</Link>,
        }}
      />,
    )
    expect(screen.getByRole('link', { name: 'Mona' })).toHaveAttribute('href', '/people/mona')
  })
})
