// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'

afterEach(cleanup)

/** Places the caret `index` code units into the first text node of `block` (a `p`, heading, or `code`). */
const caretIn = (block: HTMLElement, index: number) => {
  const node = block.firstChild
  expect(node, 'a text node to hold the caret').toBeTruthy()
  const range = document.createRange()
  range.setStart(node!, index)
  range.collapse(true)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('the editing triggers', () => {
  it('/ opens the Blocks menu and choosing Heading 1 converts the block', () => {
    render(<RichTextEditor defaultMarkdown="Salam / hello" />)
    const editor = screen.getByRole('textbox')
    caretIn(editor.querySelector('p')!, 7)
    fireEvent.input(editor, { data: '/', inputType: 'insertText' })
    expect(screen.getAllByRole('option').length).toBeGreaterThan(4)
    fireEvent.keyDown(editor, { key: 'ArrowDown' })
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(editor.querySelector('h1')?.textContent).toContain('hello')
    expect(editor.getAttribute('aria-controls')).toBeNull()
  })

  it('@ proposes members and inserting one emits [@Name](/people/{id})', () => {
    const onChange = vi.fn()
    render(
      <RichTextEditor
        defaultMarkdown="Salam @ hello"
        mentionSuggestions={[
          { id: 42, name: 'Nadim Id' },
          { id: 7, name: 'Hala Salam' },
        ]}
        onChange={onChange}
      />,
    )
    const editor = screen.getByRole('textbox')
    caretIn(editor.querySelector('p')!, 7)
    fireEvent.input(editor, { data: '@', inputType: 'insertText' })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]!.textContent).toContain('@Nadim Id')
    fireEvent.keyDown(editor, { key: 'Enter' })
    const last = onChange.mock.calls.at(-1)![0] as { markdown: string }
    expect(last.markdown).toContain('[@Nadim Id](/people/42)')
  })

  it('@ mid-word stays an ordinary character', () => {
    render(
      <RichTextEditor
        defaultMarkdown="hello@bye"
        mentionSuggestions={[{ id: 42, name: 'Nadim Id' }]}
      />,
    )
    const editor = screen.getByRole('textbox')
    caretIn(editor.querySelector('p')!, 6)
    fireEvent.input(editor, { data: '@', inputType: 'insertText' })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('/ inside a code block stays an ordinary character', () => {
    // defaultValue for HTML ingest: the editor's own markdownToHtml currently
    // drops fenced-code bodies (measured 2026-10-23, recorded as a finding).
    render(<RichTextEditor defaultValue="<pre><code>/ hi</code></pre><p>another</p>" />)
    const editor = screen.getByRole('textbox')
    // sanitizeHtml keeps the <pre> but strips a bare ingested <code>; the caret lands in its text.
    caretIn(editor.querySelector('pre')!, 1)
    fireEvent.input(editor, { data: '/', inputType: 'insertText' })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
