import type { ToastOptions } from '@/components/arc/toast-stack/toast-stack'
import { FINISHED_MS } from './store'

/** `scope` is the store's, so a later store never reuses the id of a toast that an earlier one still updates. */
export const pendingToastId = (scope: number, key: string) => `pending:${scope}:${key}`

export function pendingToast(
  id: string,
  title: string,
  onUndo: () => void,
  undoLabel = 'Undo',
): ToastOptions {
  return {
    id,
    type: 'info',
    title,
    action: { label: undoLabel, onClick: onUndo },
    duration: Infinity,
  }
}

export function sentToast(
  id: string,
  title: string,
  type: 'success' | 'error' = 'success',
): ToastOptions {
  return {
    id,
    type,
    title,
    description: undefined,
    action: undefined,
    duration: FINISHED_MS,
  }
}

export function failedToast(
  id: string,
  title: string,
  onRetry?: () => void,
  retryLabel = 'Try again',
): ToastOptions {
  return {
    ...sentToast(id, title, 'error'),
    duration: Infinity,
    action: onRetry ? { label: retryLabel, onClick: onRetry } : undefined,
  }
}
