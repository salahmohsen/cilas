import { describe, expect, it } from 'vitest'

import { calendarAdminText } from '@/components/admin/calendar-admin-text'
import type { CalendarSaveError } from '@/lib/calendar-sources'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

const codes: CalendarSaveError[] = [
  { code: 'unauthenticated' },
  { code: 'forbidden' },
  { code: 'not-found', itemId: '1' },
  { code: 'stale', itemId: '1' },
  { code: 'invalid', message: 'Use a real day.' },
  { code: 'failed' },
]

describe('calendarAdminText', () => {
  it('names the session in a stale save, and words every error code in both languages', () => {
    const english = calendarAdminText('en', en)
    expect(
      english.save.errorText({ code: 'stale', itemId: '1', name: 'Session 3: Reading Fanon' }),
    ).toBe('Someone else changed Session 3: Reading Fanon after the calendar loaded.')
    expect(english.save.errorText({ code: 'stale', itemId: '1' })).toBe(
      'Someone else changed a session after the calendar loaded.',
    )
    expect(
      calendarAdminText('ar', ar).save.errorText({ code: 'stale', itemId: '1', name: 'الجلسة ٣' }),
    ).toBe('غيّر شخص آخر الجلسة ٣ بعد تحميل التقويم.')
    expect(english.save.errorText({ code: 'invalid', message: 'Use a real day.' })).toBe(
      'A change is not valid. Use a real day.',
    )
    const arabic = calendarAdminText('ar', ar)
    for (const error of codes) {
      expect(english.save.errorText(error)).not.toMatch(/^errors\./)
      expect(arabic.save.errorText(error)).toMatch(/\p{Script=Arabic}/u)
    }
  })

  it('builds the calendar labels from the shared translations', () => {
    const { labels } = calendarAdminText('en', en)
    expect(labels.kind('session')).toBe('Sessions')
    expect(labels.newItem).toBe('New session')
  })

  it('names the Save button and the block menu in both languages', () => {
    const english = calendarAdminText('en', en).labels
    expect(english.save).toBe('Save schedule')
    expect(english.saveNote).toBe(
      'The course’s Save does not save the schedule. Use Save schedule.',
    )
    expect(english.menu).toMatchObject({
      open: 'Open',
      addNextDay: 'Add meeting',
      copyNextWeek: 'New session next week',
      deleteBlock: 'Delete meeting',
    })
    const arabic = calendarAdminText('ar', ar).labels
    expect(arabic.save).toBe('حفظ الجدول')
    expect(arabic.saveNote).toMatch(/\p{Script=Arabic}/u)
    expect(arabic.menu).toMatchObject({
      open: 'فتح',
      addNextDay: 'إضافة موعد',
      copyNextWeek: 'جلسة جديدة في الأسبوع التالي',
      deleteBlock: 'حذف الموعد',
    })
  })

  it('has the same CalendarAdmin keys in English and Arabic', () => {
    const keys = (value: object, prefix = ''): string[] =>
      Object.entries(value).flatMap(([key, child]) =>
        typeof child === 'object' ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`],
      )
    expect(keys(ar.CalendarAdmin).sort()).toEqual(keys(en.CalendarAdmin).sort())
  })
})
