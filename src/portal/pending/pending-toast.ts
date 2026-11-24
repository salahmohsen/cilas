import type { ToastOptions } from '@/components/arc/toast-stack/toast-stack'
import { FINISHED_MS } from './store'

export const pendingToastId = (key: string) => `pending:${key}`

export function pendingToast(
  key: string,
  title: string,
  onUndo: () => void,
  undoLabel = 'Undo',
): ToastOptions {
  return {
    id: pendingToastId(key),
    type: 'info',
    title,
    action: { label: undoLabel, onClick: onUndo },
    duration: Infinity,
  }
}

export function sentToast(
  key: string,
  title: string,
  type: 'success' | 'error' = 'success',
): ToastOptions {
  return {
    id: pendingToastId(key),
    type,
    title,
    description: undefined,
    action: undefined,
    duration: FINISHED_MS,
  }
}

export function failedToast(
  key: string,
  title: string,
  onRetry?: () => void,
  retryLabel = 'Try again',
): ToastOptions {
  return {
    ...sentToast(key, title, 'error'),
    action: onRetry ? { label: retryLabel, onClick: onRetry } : undefined,
  }
}
