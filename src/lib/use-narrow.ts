'use client'

import { useSyncExternalStore } from 'react'

const NARROW = '(max-width: 719px)'
const subscribeNarrow = (notify: () => void) => {
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}

/** Whether the screen is phone-sized, where a dialog becomes a bottom sheet. */
export const useNarrow = () =>
  useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  )
