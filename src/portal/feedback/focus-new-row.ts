import { announce } from './announce'

export const focusNewRow = (target: HTMLElement, message: string) => {
  target.focus()
  announce(message)
  const url = new URL(window.location.href)
  url.searchParams.delete('focus')
  window.history.replaceState(null, '', url)
}
