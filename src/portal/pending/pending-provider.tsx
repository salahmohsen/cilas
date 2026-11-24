'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { browserClock, type Clock } from './clock'
import { isModalOpen, observeModals } from './modal-open'
import { createPendingStore, type PendingApi, type PendingView } from './store'
import { undoMsFromEnv } from './undo-ms'

const PendingContext = createContext<ReturnType<typeof createPendingStore> | null>(null)
const noItem = () => null
const noSubscription = () => () => {}
const emptySnapshot = () => EMPTY_ITEMS
const EMPTY_ITEMS = new Map()

export function PendingProvider({
  children,
  clock = browserClock,
  fetcher = fetch,
  undoMs = undoMsFromEnv(),
}: {
  children: ReactNode
  clock?: Clock
  fetcher?: typeof fetch
  undoMs?: number
}) {
  const { refresh } = useRouter()
  const [store] = useState(() => createPendingStore({ clock, fetcher, undoMs, refresh }))
  const mounted = useRef(false)
  const modalOpen = useRef(false)

  useEffect(() => {
    mounted.current = true
    const flush = () => {
      void store.flush()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      store.reset()
      refresh()
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibilityChange)
    const updateModal = (open: boolean) => {
      if (modalOpen.current === open) return
      modalOpen.current = open
      store.overlay(open)
    }
    const stopObserving = observeModals(updateModal)
    updateModal(isModalOpen())
    return () => {
      mounted.current = false
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopObserving()
      window.setTimeout(() => {
        if (!mounted.current) void store.flush().finally(store.destroy)
      }, 0)
    }
  }, [refresh, store])

  return <PendingContext.Provider value={store}>{children}</PendingContext.Provider>
}

export function usePendingStore() {
  const store = useContext(PendingContext)
  if (!store) throw new Error('usePending requires a PendingProvider')
  return store
}

export function usePending(): PendingApi {
  const store = usePendingStore()
  useSyncExternalStore(store.subscribe, store.getSnapshot, emptySnapshot)
  return store
}

export function usePendingItem(key: string): PendingView | null {
  const store = useContext(PendingContext)
  return useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    () => store?.getSnapshot().get(key) ?? null,
    noItem,
  )
}
