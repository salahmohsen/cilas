// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  RichTextEditor,
  htmlToMarkdown,
  markdownToHtml,
} from '@/components/arc/rich-text-editor/rich-text-editor'
import {
  SESSION_REF_MAX,
  blockToken,
  cleanSessionRefs,
  inlineBlocks,
  mentionToken,
  sessionFacts,
  sessionIdsIn,
  splitBlocks,
} from '@/lib/session-refs'

afterEach(cleanup)

const A = '6ace42cddcfd7479422032e0'
const B = '6ace42cddcfd7479422032e9'

describe('session tokens in a body', () => {
  it('a mention is inline; a block is a paragraph of its own', () => {
    const body = `Read ${mentionToken(A, '#1 Intro')} first.\n\n${blockToken(B)}\n\nThen talk.`
    expect(splitBlocks(body)).toEqual([
      { type: 'text', markdown: `Read [#1 Intro](session:${A}) first.` },
      { type: 'block', id: B },
      { type: 'text', markdown: 'Then talk.' },
    ])
    expect(sessionIdsIn(body)).toEqual([A, B])
  })

  it('a block token inside a sentence is never a block: it reads as a mention', () => {
    const body = `See ${blockToken(B)} today`
    expect(splitBlocks(body)).toEqual([{ type: 'text', markdown: body }])
    expect(inlineBlocks(body)).toBe(`See [](session:${B}) today`)
    // Touching a paragraph line is not alone either.
    expect(splitBlocks(`Line one\n${blockToken(B)}`)).toHaveLength(1)
  })

  it('tokens inside a code fence are text', () => {
    const body = '```\n' + blockToken(A) + '\n```'
    expect(sessionIdsIn(body)).toEqual([])
    expect(splitBlocks(body)).toEqual([{ type: 'text', markdown: body }])
  })

  it('an unknown session turns into plain text: a mention keeps its words, a block goes', () => {
    const known = new Set([A])
    const body = `Hi ${mentionToken('zz', '#9 Gone')} and ${mentionToken(A, '#1 Intro')}\n\n${blockToken('zz')}\n\n${blockToken(A)}\n\nend`
    expect(cleanSessionRefs(body, known)).toBe(
      `Hi #9 Gone and ${mentionToken(A, '#1 Intro')}\n\n${blockToken(A)}\n\nend`,
    )
  })

  it('caps mentions and blocks', () => {
    const known = new Set([A])
    const many = Array.from({ length: 12 }, (_, i) => mentionToken(A, `m${i}`)).join(' ')
    const blocks = Array.from({ length: 5 }, () => blockToken(A)).join('\n\n')
    const out = cleanSessionRefs(`${many}\n\n${blocks}`, known)
    expect(out.match(/\(session:/g)).toHaveLength(SESSION_REF_MAX.mentions)
    expect(out.match(/::session\[/g)).toHaveLength(SESSION_REF_MAX.blocks)
  })

  it('without blocks (a comment) a block line counts as a mention', () => {
    expect(cleanSessionRefs(blockToken(A), new Set([A]), { blocks: false })).toBe(blockToken(A))
    expect(cleanSessionRefs(`x ${blockToken('zz')}`, new Set([A]), { blocks: false })).toBe('x')
  })

  it('facts number and date sessions as the syllabus does, cancelled marked', () => {
    const facts = sessionFacts({
      schedule: {
        start_date: '2031-03-03',
        start_precision: 'day',
        weeks: 2,
        slots: [{ weekday: 'mon', start_time: '18:00', end_time: '20:00' }],
      } as never,
      sessions: [
        { id: B, session_title: 'Two', order: 2, cancelled: true },
        { id: A, session_title: 'One', order: 1 },
      ],
    })
    expect(facts[A]).toEqual({
      n: 1,
      title: 'One',
      week: false,
      date: '2031-03-03',
      cancelled: false,
    })
    expect(facts[B]).toMatchObject({ n: 2, cancelled: true })
  })
})

const SESSIONS = [
  { id: A, label: 'Session 1: Intro', mention: '#1 Intro', hint: 'Mon 3 Mar' },
  { id: B, label: 'Session 2: Reading', mention: '#2 Reading', hint: 'Mon 10 Mar' },
]

const caretIn = (block: HTMLElement, index: number) => {
  const range = document.createRange()
  range.setStart(block.firstChild!, index)
  range.collapse(true)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('the # and / session triggers', () => {
  it('# at a word start lists the sessions and inserts [#1 Intro](session:id)', () => {
    const onChange = vi.fn()
    render(
      <RichTextEditor
        defaultMarkdown="Read # first"
        sessionSuggestions={SESSIONS}
        onChange={onChange}
      />,
    )
    const editor = screen.getByRole('textbox')
    caretIn(editor.querySelector('p')!, 6)
    fireEvent.input(editor, { data: '#', inputType: 'insertText' })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(editor, { key: 'Enter' })
    const last = onChange.mock.calls.at(-1)![0] as { markdown: string }
    expect(last.markdown).toBe(`Read [#1 Intro](session:${A}) first`)
  })

  it('with no Heading 1, "# " stays text and closes the list; "## " still makes a Heading 2', () => {
    render(<RichTextEditor defaultMarkdown="x" sessionSuggestions={SESSIONS} minHeading={2} />)
    const editor = screen.getByRole('textbox')
    const p = editor.querySelector('p')!
    ;(p.firstChild as Text).data = '#'
    caretIn(p, 1)
    fireEvent.input(editor, { data: '#', inputType: 'insertText' })
    expect(screen.getAllByRole('option')).toHaveLength(2)
    ;(p.firstChild as Text).data = '# '
    caretIn(p, 2)
    fireEvent.input(editor, { data: ' ', inputType: 'insertText' })
    expect(editor.querySelector('h1')).toBeNull()
    // Closed: the rows may linger for their exit animation, but the field no longer points at them.
    expect(editor.getAttribute('aria-controls')).toBeNull()
    ;(p.firstChild as Text).data = '## '
    caretIn(p, 3)
    fireEvent.input(editor, { data: ' ', inputType: 'insertText' })
    expect(editor.querySelector('h2')).toBeTruthy()
  })

  it('with no Heading 1, the / menu offers none and an older one loads as Heading 2', () => {
    render(<RichTextEditor defaultMarkdown={'# Old\n\nx /'} minHeading={2} />)
    const editor = screen.getByRole('textbox')
    expect(editor.querySelector('h1')).toBeNull()
    expect(editor.querySelector('h2')?.textContent).toBe('Old')
    caretIn(editor.querySelector('p')!, 3)
    fireEvent.input(editor, { data: '/', inputType: 'insertText' })
    const labels = screen.getAllByRole('option').map((o) => o.textContent)
    expect(labels.some((l) => l?.includes('Heading 1'))).toBe(false)
    expect(labels.some((l) => l?.includes('Heading 3'))).toBe(true)
  })

  it('# opens nothing without sessions (a space that is not a course space)', () => {
    render(<RichTextEditor defaultMarkdown="Read # first" />)
    const editor = screen.getByRole('textbox')
    caretIn(editor.querySelector('p')!, 6)
    fireEvent.input(editor, { data: '#', inputType: 'insertText' })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('the # list filters by number, title or date', () => {
    render(<RichTextEditor defaultMarkdown="x #2" sessionSuggestions={SESSIONS} />)
    const editor = screen.getByRole('textbox')
    const p = editor.querySelector('p')!
    caretIn(p, 3)
    fireEvent.input(editor, { data: '#', inputType: 'insertText' })
    caretIn(p, 4)
    fireEvent.input(editor, { data: '2', inputType: 'insertText' })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('Reading'),
    ])
  })

  it('/ lists sessions after the blocks; one chosen becomes a block line of its own', () => {
    const onChange = vi.fn()
    render(
      <RichTextEditor defaultMarkdown="Before" sessionSuggestions={SESSIONS} onChange={onChange} />,
    )
    const editor = screen.getByRole('textbox')
    const p = editor.querySelector('p')!
    ;(p.firstChild as Text).data = 'Before /'
    caretIn(p, 8)
    fireEvent.input(editor, { data: '/', inputType: 'insertText' })
    ;(p.firstChild as Text).data = 'Before /read'
    caretIn(p, 12)
    fireEvent.input(editor, { data: 'd', inputType: 'insertText' })
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('Reading')])
    fireEvent.keyDown(editor, { key: 'Enter' })
    const last = onChange.mock.calls.at(-1)![0] as { markdown: string }
    expect(last.markdown).toBe(`Before\n\n::session[${B}]`)
  })

  it('a block and a mention survive a round trip through the editor', () => {
    const md = `Read [#1 Intro](session:${A}) first\n\n::session[${B}]\n\nafter`
    const html = markdownToHtml(md, { sessionLabel: () => 'Session 2: Reading' })
    expect(html).toContain(`<a href="session-block:${B}">Session 2: Reading</a>`)
    expect(htmlToMarkdown(html)).toBe(md)
  })
})
