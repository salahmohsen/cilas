import type { ComponentProps } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventDescription } from '@/components/events/event-description'
import { RichTextField } from '@/components/RichTextField'
import { RichTextReferencesProvider } from '@/components/rich-text-references'
import type { Event } from '@/payload-types'
import type { RichTextReferences } from '@/lib/rich-text-references'
import messages from '../../messages/en.json'
import { movie } from '../fixtures/movie'

vi.mock('@/lib/use-narrow', () => ({ useNarrow: () => false }))
vi.mock('@/components/resolved-rich-text-field', () => ({
  ResolvedRichTextField: (props: ComponentProps<typeof RichTextField>) => (
    <RichTextField {...props} />
  ),
}))
afterEach(cleanup)

const text = (value: string, format = 0) => ({
  type: 'text',
  version: 1,
  text: value,
  format,
  mode: 'normal',
  detail: 0,
  style: '',
})
const paragraph = (children: unknown[], format = '') => ({
  type: 'paragraph',
  version: 1,
  children,
  format,
  direction: null,
  indent: 0,
})
const documentOf = (children: unknown[]) =>
  ({
    root: { type: 'root', version: 1, children, format: '', direction: null, indent: 0 },
  }) as NonNullable<Event['description']>
const block = (blockType: string, fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  fields: { blockType, ...fields },
})
const mention = {
  type: 'inlineBlock',
  version: 1,
  fields: { blockType: 'mention', type: 'article', article: 1, label: 'Read the essay' },
}
const reference = { relationTo: 'articles', value: 1 }
const references: RichTextReferences = {
  'articles:1': {
    href: '/articles/essay',
    preview: {
      kind: 'article',
      title: 'The essay',
      text: 'An essay summary',
      image: null,
      meta: null,
    },
  },
}

const show = (children: unknown[], refs = references) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RichTextReferencesProvider references={refs}>
        <EventDescription data={documentOf(children)} />
      </RichTextReferencesProvider>
    </NextIntlClientProvider>,
  )

describe('event editor feature rendering', () => {
  it('retains text formatting, alignment, headings, quotes, lists and rules', () => {
    const { container } = show([
      paragraph(
        [
          text('Bold', 1),
          text('Italic', 2),
          text('Strike', 4),
          text('Underline', 8),
          text('Code', 16),
          text('Sub', 32),
          text('Super', 64),
        ],
        'right',
      ),
      { ...paragraph([text('Discussion')]), type: 'heading', tag: 'h6' },
      { type: 'quote', version: 1, children: [text('A quotation')] },
      ...['bullet', 'number', 'check'].map((listType) => ({
        type: 'list',
        version: 1,
        listType,
        tag: listType === 'number' ? 'ol' : 'ul',
        start: 1,
        children: [
          {
            type: 'listitem',
            version: 1,
            value: 1,
            checked: listType === 'check' ? true : undefined,
            children: [text(`${listType} item`)],
          },
        ],
      })),
      { type: 'horizontalrule', version: 1 },
    ])
    expect(container.querySelector('strong')).toHaveTextContent('Bold')
    expect(container.querySelector('em')).toHaveTextContent('Italic')
    expect(screen.getByText('Underline')).toHaveStyle({ textDecoration: 'underline' })
    expect(screen.getByText('Strike')).toHaveStyle({ textDecoration: 'line-through' })
    expect(container.querySelector('code')).toHaveTextContent('Code')
    expect(container.querySelector('sub')).toHaveTextContent('Sub')
    expect(container.querySelector('sup')).toHaveTextContent('Super')
    expect(container.querySelector('p')).toHaveStyle({ textAlign: 'right' })
    expect(screen.getByRole('heading', { level: 2, name: 'Discussion' })).toBeInTheDocument()
    expect(container.querySelector('blockquote')).toHaveTextContent('A quotation')
    expect(container.querySelector('ol')).toHaveTextContent('number item')
    expect(container.querySelector('input[type="checkbox"]')).toBeChecked()
    expect(container.querySelector('hr')).toBeInTheDocument()
  })

  it('keeps authorized mentions, internal links, related cards and legacy relationships inside columns', () => {
    show([
      block('columns', {
        first: documentOf([
          paragraph([
            mention,
            {
              type: 'link',
              version: 3,
              fields: { linkType: 'internal', doc: reference },
              children: [text('Internal essay')],
            },
          ]),
        ]),
        second: documentOf([
          block('relatedContent', { document: reference }),
          { type: 'relationship', version: 1, ...reference },
        ]),
      }),
    ])
    expect(screen.getByRole('link', { name: 'Read the essay' })).toHaveAttribute(
      'href',
      '/en/articles/essay',
    )
    expect(screen.getByRole('link', { name: 'Internal essay' })).toHaveAttribute(
      'href',
      '/en/articles/essay',
    )
    expect(screen.getAllByText('An essay summary')).toHaveLength(2)
  })

  it('keeps unavailable mentions readable and omits protected related content', () => {
    show([paragraph([mention]), block('relatedContent', { document: reference })], {})
    expect(screen.getByText('Read the essay')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText('An essay summary')).toBeNull()
  })

  it('renders uploaded media, galleries, movie blocks and a brief profile without discarding neighboring content', () => {
    const image = {
      id: 1,
      url: '/still.webp',
      alt: 'Screening still',
      mimeType: 'image/webp',
      width: 800,
      height: 600,
    }
    show([
      { type: 'upload', version: 3, relationTo: 'media', value: image },
      block('gallery', { images: [{ image, caption: 'From the film' }] }),
      block('movie', { movie }),
      block('personProfile', {
        person: {
          id: 1,
          name: 'Speaker',
          slug: 'speaker',
          visible: true,
          bio: documentOf([
            paragraph([text('A brief introduction.')]),
            paragraph([text('The full biography stays on the profile.')]),
          ]),
        },
      }),
    ])
    expect(screen.getAllByAltText('Screening still')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Screening still/ })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
    expect(screen.getByText('From the film')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Faces (1968)' })).toBeInTheDocument()
    expect(screen.getByText('A brief introduction.')).toBeInTheDocument()
    expect(screen.queryByText('The full biography stays on the profile.')).toBeNull()
    expect(screen.getByRole('link', { name: 'Speaker' })).toHaveAttribute(
      'href',
      '/en/people/speaker',
    )
  })
})
