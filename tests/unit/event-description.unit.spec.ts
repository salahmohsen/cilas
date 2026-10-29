import { describe, expect, it } from 'vitest'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { eventDescription } from '@/lib/event-description'

const documentOf = (children: unknown[]) =>
  ({
    root: { type: 'root', version: 1, children, direction: null, format: '', indent: 0 },
  }) as SerializedEditorState
const heading = (tag: string, text: string) => ({
  type: 'heading',
  version: 1,
  tag,
  children: [{ type: 'text', version: 1, text }],
})

describe('event description presentation', () => {
  it('makes the discussion an H2 and removes spacers without altering the saved document or embedded profiles', () => {
    const profile = {
      type: 'block',
      version: 2,
      fields: {
        blockType: 'personProfile',
        person: { id: 1, bio: documentOf([heading('h6', 'Saved biography')]) },
      },
    }
    const saved = documentOf([
      { type: 'paragraph', version: 1, children: [] },
      heading('h6', 'Post-screening discussion'),
      profile,
    ])
    const original = structuredClone(saved)
    const rendered = eventDescription(saved)
    expect(rendered.root.children).toEqual([heading('h2', 'Post-screening discussion'), profile])
    expect(saved).toEqual(original)
  })

  it('preserves nested section levels and paragraphs with inline content', () => {
    const paragraph = {
      type: 'paragraph',
      version: 1,
      children: [
        { type: 'inlineBlock', version: 2, fields: { blockType: 'mention', label: 'Faces' } },
      ],
    }
    const saved = documentOf([heading('h2', 'Discussion'), paragraph, heading('h3', 'Speakers')])
    expect(eventDescription(saved)).toEqual(saved)
  })

  it('cleans column spacers while retaining the column order and profile data', () => {
    const person = { type: 'block', version: 2, fields: { blockType: 'personProfile', person: 1 } }
    const column = documentOf([person, { type: 'paragraph', version: 1, children: [] }])
    const saved = documentOf([
      {
        type: 'block',
        version: 2,
        fields: { blockType: 'columns', first: column, second: column },
      },
    ])
    const expected = documentOf([
      {
        type: 'block',
        version: 2,
        fields: { blockType: 'columns', first: documentOf([person]), second: documentOf([person]) },
      },
    ])
    expect(eventDescription(saved)).toEqual(expected)
  })
})
