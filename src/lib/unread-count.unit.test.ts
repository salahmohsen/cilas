import { describe, expect, it } from 'vitest'

import { unreadCount } from './unread-count'

const words = {
  some: ({ count, shown }: { count: number; shown: string }) => `${shown} of ${count}`,
  many: ({ cap }: { cap: string }) => `more than ${cap}`,
}

describe('unreadCount', () => {
  it('shows the count and says it up to 9', () => {
    expect(unreadCount(3, 'en', words)).toEqual({ shown: '3', spoken: '3 of 3' })
    expect(unreadCount(9, 'en', words)).toEqual({ shown: '9', spoken: '9 of 9' })
  })

  it('shows 9+ and says more than 9 above 9', () => {
    expect(unreadCount(10, 'en', words)).toEqual({ shown: '9+', spoken: 'more than 9' })
    expect(unreadCount(120, 'en', words)).toEqual({ shown: '9+', spoken: 'more than 9' })
  })

  it('writes Arabic-Indic digits on Arabic pages, in the badge and in the words', () => {
    expect(unreadCount(3, 'ar', words)).toEqual({ shown: '٣', spoken: '٣ of 3' })
    expect(unreadCount(12, 'ar', words)).toEqual({ shown: '٩+', spoken: 'more than ٩' })
  })
})
