'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { fromToast, useToastStack } from '@/components/arc/toast-stack/toast-stack'
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
import type { PendingState } from './machine'
import { pendingToast, pendingToastId, failedToast, sentToast } from './pending-toast'
import { isModalOpen, observeModals } from './modal-open'
import { createPendingStore, type PendingApi, type PendingView } from './store'
import { undoMsFromEnv } from './undo-ms'

const PendingContext = createContext<ReturnType<typeof createPendingStore> | null>(null)
const noItem = () => null
const noSubscription = () => () => {}
const emptySnapshot = () => EMPTY_ITEMS
const EMPTY_ITEMS = new Map()

function takeLeaveHint() {
  const key = 'portal.pending.leaveHint'
  try {
    if (sessionStorage.getItem(key)) return false
    sessionStorage.setItem(key, '1')
  } catch {
    // The provider still shows it once when the browser blocks session storage.
  }
  return true
}

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
  const t = useTranslations('Portal.pending')
  const { toast, update, dismiss } = useToastStack()
  const [store] = useState(() => createPendingStore({ clock, fetcher, undoMs, refresh }))
  const mounted = useRef(false)
  const modalOpen = useRef(false)
  const toastFocused = useRef(false)
  const mirrored = useRef(new Map<string, PendingState>())
  const showedLeaveHint = useRef(false)

  useEffect(() => {
    mounted.current = true
    const syncToasts = () => {
      const items = store.getSnapshot()
      const prior = mirrored.current
      for (const key of prior.keys()) {
        if (!items.has(key)) prior.delete(key)
      }
      for (const item of items.values()) {
        const { key, state, status, result } = item
        const before = prior.get(key)
        if (before === state) continue
        prior.set(key, state)
        const id = pendingToastId(key)
        if ((state === 'pending' || state === 'paused') && before === undefined) {
          const n = Math.ceil(store.undoMs / 1000)
          toast({
            ...pendingToast(
              key,
              item.toastLine?.(n) ?? t('decision', { n }),
              () => store.undo(key),
              t('undo'),
            ),
            description: !showedLeaveHint.current && takeLeaveHint() ? t('leaveHint') : undefined,
          })
          showedLeaveHint.current = true
        } else if (state === 'committing') {
          update(id, { action: undefined, duration: Infinity })
        } else if (state === 'sent') {
          const emailed =
            result && typeof result === 'object' && 'emailed' in result ? result.emailed : undefined
          const title = t(
            emailed === null ? 'decided' : emailed === false ? 'emailFailed' : 'emailSent',
          )
          update(id, sentToast(key, title, emailed === false ? 'error' : 'success'))
        } else if (state === 'failed') {
          const retry = status === 403 ? undefined : () => store.retry(key)
          update(
            id,
            failedToast(key, t(status === 403 ? 'signInAgain' : 'notSaved'), retry, t('tryAgain')),
          )
        } else if (state === 'undone') {
          if (status === 409) update(id, sentToast(key, t('changed'), 'error'))
          else dismiss(id)
        }
      }
    }
    const stopToasts = store.subscribe(syncToasts)
    syncToasts()
    const flush = () => {
      void store.flush()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      for (const key of mirrored.current.keys()) dismiss(pendingToastId(key))
      mirrored.current.clear()
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
    const updateToastFocus = (target: EventTarget | null) => {
      const inside = fromToast({ target })
      if (toastFocused.current === inside) return
      toastFocused.current = inside
      store.overlay(inside)
    }
    const toastFocusIn = (event: FocusEvent) => updateToastFocus(event.target)
    const toastFocusOut = (event: FocusEvent) => updateToastFocus(event.relatedTarget)
    document.addEventListener('focusin', toastFocusIn)
    document.addEventListener('focusout', toastFocusOut)
    updateToastFocus(document.activeElement)
    const stopObserving = observeModals(updateModal)
    updateModal(isModalOpen())
    return () => {
      mounted.current = false
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('focusin', toastFocusIn)
      document.removeEventListener('focusout', toastFocusOut)
      stopObserving()
      stopToasts()
      window.setTimeout(() => {
        if (mounted.current) return
        const flushed = store.flush()
        syncToasts()
        void flushed.finally(() => {
          syncToasts()
          store.destroy()
        })
      }, 0)
    }
  }, [dismiss, refresh, store, t, toast, update])

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
