import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'
import { markdownBaseline, markdownToSend } from '@/components/markdown-edit'

describe('the mounted editor and markdownToSend', () => {
  it('sends a stored bio back unchanged when the editor only re-serialised it', () => {
    const original =
      'Some *italic* words\na soft break and [a link](https://example.com)\n\n- one\n- two\n\n```\ncode\n```'
    const onChange = vi.fn()
    render(<RichTextEditor defaultMarkdown={original} onChange={onChange} />)
    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)![0].markdown as string
    expect(last).not.toBe(original)
    expect(markdownToSend(original, last, markdownBaseline(original))).toBe(original)
  })
})
