import { createTranslator } from 'next-intl'
import { formatsOf } from '@/i18n/formats'
import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
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

describe('pending: localized decision copy', () => {
  it('formats every decision verb with the undo window', () => {
    const t = createTranslator({
      locale: 'en',
      messages: en,
      namespace: 'Portal.pending',
      formats: formatsOf('en'),
    })
    expect([
      t('approving', { n: 5 }),
      t('askingForChanges', { n: 5 }),
      t('declining', { n: 5 }),
      t('removing', { n: 5 }),
      t('keeping', { n: 5 }),
      t('paused'),
    ]).toEqual([
      'Approving. Email in 5 s',
      'Asking for changes. Email in 5 s',
      'Declining. Email in 5 s',
      'Removing. Email in 5 s',
      'Keeping it. Email in 5 s',
      'Paused. Email waits.',
    ])
  })

  it('uses Arabic-Indic digits and Arabic singular, dual and plural forms', () => {
    const t = createTranslator({
      locale: 'ar',
      messages: ar,
      namespace: 'Portal.pending',
      formats: formatsOf('ar'),
    })
    expect(t('approving', { n: 5 })).toBe('جارٍ الاعتماد. يُرسل البريد خلال ٥ ث')
    expect(t('bar.count', { n: 1 })).toBe('رسالة واحدة بانتظار الإرسال')
    expect(t('bar.count', { n: 2 })).toBe('رسالتان بانتظار الإرسال')
    expect(t('bar.count', { n: 3 })).toBe('٣ رسائل بانتظار الإرسال')
  })
})
