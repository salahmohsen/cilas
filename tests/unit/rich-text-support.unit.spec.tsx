import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RichTextField } from '@/components/RichTextField'
import { RichTextReferencesProvider } from '@/components/rich-text-references'
import { resolveRichTextReferences } from '@/api/rich-text-references.api'
import { emailRichTextHTML } from '@/emails/rich-text'
import { plainText } from '@/lib/plaintext'
import { lexicalText } from '@/plugins/typesense/documents'
import { profileBioReadOnly } from '@/lib/profile-rich-text'
import type { RichTextReferences } from '@/lib/rich-text-references'
import en from '../../messages/en.json'

afterEach(cleanup)

const text = (value: string) => ({
  type: 'text',
  version: 1,
  text: value,
  format: 0,
  mode: 'normal',
  detail: 0,
  style: '',
})
const paragraph = (children: unknown[]) => ({
  type: 'paragraph',
  version: 1,
  children,
  format: '',
  direction: null,
  indent: 0,
})
const doc = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, format: '', direction: null, indent: 0 },
})
const mention = {
  type: 'inlineBlock',
  version: 1,
  fields: { blockType: 'mention', id: 'm', label: 'Read Plato', type: 'article', article: 1 },
}
const related = {
  type: 'block',
  version: 2,
  fields: { blockType: 'relatedContent', document: { relationTo: 'articles', value: 1 } },
}
const columns = {
  type: 'block',
  version: 2,
  fields: {
    blockType: 'columns',
    columnCount: '2',
    first: doc([paragraph([text('First '), mention])]),
    second: doc([paragraph([text('Second')])]),
  },
}
const internalLink = {
  type: 'link',
  version: 3,
  fields: { linkType: 'internal', doc: { relationTo: 'articles', value: 1 } },
  children: [text('Original article')],
}
const references: RichTextReferences = {
  'articles:1': {
    href: '/articles/plato',
    preview: { kind: 'article', title: 'Plato', text: 'A short summary.', image: null, meta: null },
  },
}

function show(children: unknown[], refs = references) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RichTextReferencesProvider references={refs}>
        <RichTextField data={doc(children)} />
      </RichTextReferencesProvider>
    </NextIntlClientProvider>,
  )
}

describe('rich text reference rendering', () => {
  it('renders a summary card and a correct internal link', () => {
    show([related, paragraph([internalLink])])
    expect(screen.getByText('A short summary.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Original article' })).toHaveAttribute(
      'href',
      '/en/articles/plato',
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('links mentions inside columns', () => {
    show([columns])
    expect(screen.getByRole('link', { name: 'Read Plato' })).toHaveAttribute(
      'href',
      '/en/articles/plato',
    )
  })

  it('keeps inaccessible mentions as text and omits inaccessible cards', () => {
    show([paragraph([mention]), related], {})
    expect(screen.getByText('Read Plato')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('A short summary.')).not.toBeInTheDocument()
  })
})

describe('reference authorization', () => {
  it('batches nested mentions, cards and links and rechecks supplied documents', async () => {
    const find = vi
      .fn()
      .mockResolvedValue({ docs: [{ id: 1, title: 'Plato', slug: 'plato', _status: 'published' }] })
    const resolved = await resolveRichTextReferences(
      { find } as unknown as Payload,
      [doc([columns, related, paragraph([internalLink])])],
      { locale: 'en' },
    )
    expect(find).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'articles',
        overrideAccess: false,
        user: null,
        draft: false,
        where: { id: { in: [1] } },
      }),
    )
    expect(resolved['articles:1'].href).toBe('/articles/plato')
  })

  it('omits drafts even when a query returns one', async () => {
    const find = vi
      .fn()
      .mockResolvedValue({ docs: [{ id: 1, title: 'Secret', slug: 'secret', _status: 'draft' }] })
    expect(
      await resolveRichTextReferences({ find } as unknown as Payload, doc([related]), {
        locale: 'en',
      }),
    ).toEqual({})
  })
})

describe('email and text conversion', () => {
  it('keeps column text in excerpts and search', () => {
    for (const result of [
      plainText({ data: doc([columns]) as never }),
      lexicalText(doc([columns])),
    ]) {
      expect(result).toContain('First Read Plato')
      expect(result).toContain('Second')
    }
  })

  it('renders email-safe mention links, summaries and legacy columns', () => {
    const html = emailRichTextHTML(doc([columns, related]), references, 'https://cilas.example')
    expect(html).toContain('https://cilas.example/en/articles/plato')
    expect(html).toContain('Read Plato')
    expect(html).toContain('Second')
    expect(html).toContain('A short summary.')
    expect(html).not.toContain('unknown node')
  })

  it('escapes labels and preserves inaccessible mention text in email', () => {
    const html = emailRichTextHTML(
      doc([
        paragraph([
          { ...mention, fields: { ...mention.fields, label: '<script>alert(1)</script>' } },
        ]),
        related,
      ]),
    )
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href=')
  })
})

describe('member bio preservation', () => {
  it('allows ordinary Markdown formatting', () => {
    expect(
      profileBioReadOnly(doc([paragraph([text('Bio'), { ...text('bold'), format: 1 }])])),
    ).toBe(false)
  })

  it.each([
    columns,
    related,
    paragraph([mention]),
    paragraph([{ ...text('underlined'), format: 8 }]),
    paragraph([internalLink]),
  ])('protects content the member editor cannot preserve', (node) => {
    expect(profileBioReadOnly(doc([node]))).toBe(true)
  })
})
