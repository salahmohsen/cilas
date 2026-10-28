export const AUTH_CHANGED = 'cilas-auth-changed'
export const announceAuthChange = () => {
  window.dispatchEvent(new Event(AUTH_CHANGED))
  try {
    localStorage.setItem(AUTH_CHANGED, String(Date.now()))
  } catch {}
}
