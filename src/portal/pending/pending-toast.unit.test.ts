import { describe, expect, it, vi } from 'vitest'
import { failedToast, pendingToast, sentToast } from './pending-toast'

const key = 'review:articles:12'
const id = 'pending:review:articles:12'
const title = 'Approving. Email in 5 s'

describe('pending: toast options', () => {
  it('shows a fixed title and an Undo action with no expiry', () => {
    const undo = vi.fn()
    const options = pendingToast(key, title, undo)
    expect(options).toEqual({
      id,
      type: 'info',
      title,
      action: { label: 'Undo', onClick: undo },
      duration: Infinity,
    })
    expect(pendingToast(key, title, undo).title).toBe(options.title)
  })

  it('shows a sent status for eight seconds without an action', () => {
    expect(sentToast(key, 'Email sent')).toEqual({
      id,
      type: 'success',
      title: 'Email sent',
      description: undefined,
      action: undefined,
      duration: 8000,
    })
  })

  it('shows a failure with a retry action for eight seconds', () => {
    const retry = vi.fn()
    expect(failedToast(key, 'Not saved.', retry)).toEqual({
      id,
      type: 'error',
      title: 'Not saved.',
      description: undefined,
      action: { label: 'Try again', onClick: retry },
      duration: 8000,
    })
  })
})
