import { afterEach, describe, expect, it, vi } from 'vitest'

import { afterHeadStart, TASK_READS_HEAD_START_MS } from './head-start'

afterEach(() => vi.useRealTimers())

describe('afterHeadStart', () => {
  it('starts no read before the head start, so the shell goes out first', async () => {
    vi.useFakeTimers()
    let reads = 0
    const result = afterHeadStart(async () => {
      reads += 1
      return 'sets'
    })
    await vi.advanceTimersByTimeAsync(TASK_READS_HEAD_START_MS - 1)
    expect(reads).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toBe('sets')
    expect(reads).toBe(1)
  })
})
