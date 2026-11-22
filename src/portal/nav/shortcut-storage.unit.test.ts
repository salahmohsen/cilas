import { describe, expect, it } from 'vitest'

import { readShortcutOn, writeShortcutOn } from './shortcut-storage'

const broken = {
  getItem: () => {
    throw new Error('storage blocked')
  },
  setItem: () => {
    throw new Error('storage blocked')
  },
}

const memory = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('shortcut storage', () => {
  it('a read that throws gives on', () => {
    expect(readShortcutOn(broken, 7)).toBe(true)
  })

  it('a write that throws does not throw', () => {
    expect(() => writeShortcutOn(broken, 7, false)).not.toThrow()
  })

  it('with nothing stored the shortcut is on', () => {
    expect(readShortcutOn(memory(), 7)).toBe(true)
  })

  it('off then on round-trips, per account', () => {
    const storage = memory()
    writeShortcutOn(storage, 7, false)
    expect(readShortcutOn(storage, 7)).toBe(false)
    expect(readShortcutOn(storage, 8)).toBe(true)
    writeShortcutOn(storage, 7, true)
    expect(readShortcutOn(storage, 7)).toBe(true)
  })
})
